var fs = require('fs');
var mm = require('musicmetadata');
var async = require('async');

exports.songs   = [];
exports.artists = [];
exports.albums  = [];
exports.genres  = [];

// ID's are determined by insertion order, making for quicker lookups
var insertId = 1;
var artistInsertId = 1;
var albumInsertId = 1;
var genreInsertId = 1;

// Used to throttle the number of fd opened
var maxOpenFiles = 40;
var openFiles = 0;
var pendingFiles = [];

function Song(path) {
  this.id = 0;
  this.path = path;
  this.title = '';
  this.artist = '';
  this.album = 'Unspecified';
  this.genre = 'Unspecified';
}

function Artist(id, name) {
  this.id = id;
  this.name = name;
}

function Album(id, name, artist) {
  this.id = id;
  this.name = name;
  this.artist = artist;
}

function Genre(id, name) {
  this.id = id;
  this.name = name;
}

// Adds the next song in pendingFiles queue to the library
var nextSong = function(callback) {
  // Decrease number of openFiles and run the next function if under 
  // the maximum we set
  openFiles--;
  if (pendingFiles.length && openFiles < maxOpenFiles)
    addSong(pendingFiles.shift(), callback);
};

// Adds a single song to the library given a file path to an mp3
var addSong = function(path, callback) {
  // If there's too many open files, push the function to pendingFiles
  // This is to prevent having too many file descriptors open
  if (openFiles >= maxOpenFiles) {
    pendingFiles.push(path);
    return;
  }

  openFiles++;
  var stream = fs.createReadStream(path);

  // Skip to next song if there was a read error
  stream.on('error', function(err) {
    nextSong(callback);
    return;
  });

  var parser = new mm(stream);

  // Iterate through desired data and listen for their events
  var song = new Song(path);
  var metaData = ['title', 'artist', 'album', 'genre'];

  // Collect meta-data
  async.each(metaData,
    function(attr) {
      var key = attr;
      parser.on(attr, function (result) {
        if (result instanceof Array)
          song[attr] = result[0];
        else
          song[attr] = result;
      });
  }, function(err) {});

  // Kill the stream when parsing is done, add the song to the library
  parser.on('done', function (err) {
    stream.close();

    // If title or artist aren't set, use the song's path to guess
    if (!song.title)
      song.title = getTitleFromPath(song.path);

    if (!song.artist)
      song.artist = getArtistFromPath(song.path);

    // Add the artist if it doesn't exist
    exports.getByProperties(exports.artists, { 'name': song.artist },
      function(results, constraint) {
        if (!results.length) {
          artist = new Artist(artistInsertId++, constraint.name);
          exports.artists.push(artist);
        }
      });

    // Add the album if it doesn't exist
    exports.getByProperties(exports.albums,
      { 'name': song.album, 'artist': song.artist },
      function(results, constraint) {
        if (!results.length) {
          album = new Album(albumInsertId++, constraint.name, constraint.artist);
          exports.albums.push(album);
        }
      });

    // Add the genre if it doesn't exist
    exports.getByProperties(exports.genres, { 'name': song.genre },
      function(results, constraint) {
        if (!results.length) {
          genre = new Genre(genreInsertId++, constraint.name);
          exports.genres.push(genre);
        }
      });

    song.id = insertId++;
    exports.songs.push(song);

    // Invoke callback every 400 songs and when done processing files
    if (exports.songs.length % 400 === 0)
      callback();
    else if (openFiles === 1)
      callback();

    nextSong(callback);
  });
};

// Function to recurse through a directory, adding mp3's to the library
exports.addToLibrary = function(dir, callback) {
  // Loop through directory
  fs.readdir(dir, function(err, files) {
    if (err) return;

    async.each(files, function(file) {
      var path = dir + '/' + file;
      var stats = fs.stat(path, function(err, stats) {
        if (err) return;

        // If it's a directory, then use recursion
        // And if it's an MP3, call addSong
        if (stats && stats.isDirectory())
          exports.addToLibrary(path, callback);
        else if (path.split('.').pop().toLowerCase() == 'mp3')
          addSong(path, callback);
      });
    }, function(err) {});
  });
};

// A synchronous version of addToLibrary for when initially loading music
exports.addToLibrarySync = function(dir, callback) {
  var files = fs.readdirSync(dir);
  var songPaths = [];
  var dirPaths = [];

  for (var i = 0; i < files.length; i++) {
    var path = dir + '/' + files[i];
    var stats = fs.statSync(path);

    if (stats && stats.isDirectory())
      dirPaths.push(path);
    else if (path.split('.').pop().toLowerCase() == 'mp3') {
      songPaths.push(path);
    }
  }

  // Loop through songs, and use callback when it's the last song in the dir
  for (i = 0; i < songPaths.length; i++) {
      addSong(songPaths[i], callback);
  }

  // Loop through directories
  for (i = 0; i < dirPaths.length; i++) {
      exports.addToLibrarySync(dirPaths[i], callback);
  }
};

// Returns the song title based on the full path to the song file
// Should be used if no meta-data existed. If the path contained a "-", it 
// assumes everything after the last occurrence is the title. Otherwise, if no 
// dash was found, returns the filename
var getTitleFromPath = function(path) {
  var title;
  var splitPath = path.split("-");

  if (splitPath.length > 1) {
    title = splitPath[splitPath.length - 1];
  } else {
    splitPath = path.split("/");
    title = splitPath[splitPath.length - 1];
  }

  title = title.trim().replace(".mp3", "");
  return title;
};

// Used to guess the artist if no meta-data was set. For now just use the first 
// half of the filename preceding "-". Also, consider using a music API for this
var getArtistFromPath = function(path) {
  var artist = "";
  var splitPath = path.split("-");

  if (splitPath.length > 1) {
    splitPath = splitPath[splitPath.length - 2].split("/");
    artist = splitPath[splitPath.length - 1].trim();
  }

  return artist;
};

// Uses Binary Search to return an object from one of songs, artists, albums 
// or genres, based on its id
exports.getById = function(array, id, callback) {
  var high = array.length - 1;
  var low = 0;

  async.whilst(function() { return high >= low; }, function(next) {
    var mid = Math.floor((low + high) / 2);
    if (array[mid].id < id) {
      low = mid + 1;
    } else if (array[mid].id > id) {
      high = mid - 1;
    } else {
      callback(JSON.parse(JSON.stringify(array[mid])));
      return;
    }
    next();
  }, function(err) { callback(null); });
};

// Uses Sequential Search on an array (one of songs, artists, albums or genres), 
// and returns an array of objects such that they have the properties supplied.
// Example Usage: 
// getByProperties(songs, { 'genre': 'country', 'album': 'Unspecified' }, callback)
exports.getByProperties = function(array, properties, callback) {
  var results = [];
  var length = array.length;
  var i = 0;

  async.whilst(function() { return i < length; }, function(next) {
    var match = true;
    for (var key in properties) {
      if (array[i][key] !== properties[key]) {
        match = false;
        break;
      }
    }

    if (match)
      results.push(JSON.parse(JSON.stringify(array[i])));

    i++;
    next();
  }, function(err) { callback(results, properties); });
};
