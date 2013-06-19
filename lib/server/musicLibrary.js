var fs = require('fs');
var mm = require('musicmetadata');
var async = require('async');

var songs   = [];
var artists = [];
var albums  = [];
var genres  = [];

// ID's are determined by insertion order, making for quicker lookups
var insertId = 1;
var artistInsertId = 1;
var albumInsertId = 1;
var genreInsertId = 1;

function Song(id, path) {
  this.id = id;
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

// Function to recurse through a directory, looking for songs to add
// Evokes songCallback() whenever all songs in a directory have been processed
// Consider rewriting later to make fully async
// TODO: Use bagpipe to avoid error: EMFILE, too many open files
exports.addToLibrary = function(dir, songCallback) {
  // Get all files and folders in directory
  var list = fs.readdirSync(dir);

  var numSongs = 0;
  var songsCovered = 0;

  async.each(list, function(file, callback) {
    var path = dir + '/' + file;

    // If it's a directory, then use recursion
    var stat = fs.statSync(path);
    if (stat && stat.isDirectory())
      exports.addToLibrary(path, songCallback);

    // If it's an MP3, get its meta-data
    else if (path.split('.').pop().toLowerCase() == 'mp3') {
      numSongs++;

      var stream = fs.createReadStream(path);
      var parser = new mm(stream);

      // Iterate through desired data and listen for their events
      var song = new Song(insertId++, path);
      var metaData = ['title', 'artist', 'album', 'genre'];

      // Collect meta-data
      async.each(metaData,
        function(attr, callback) {
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
        // If title or artist aren't set, use the song's path to guess
        if (!song.title)
          song.title = getTitleFromPath(song.path);

        if (!song.artist)
          song.artist = getArtistFromPath(song.path);

        // Add the artist if it doesn't exist
        exports.getByProperties(exports.getArtists(), { 'name': song.artist },
          function(results, constraint) {
            if (!results.length) {
              artist = new Artist(artistInsertId++, constraint.name);
              artists.push(artist);
            }
          });

        // Add the album if it doesn't exist
        exports.getByProperties(exports.getAlbums(),
          { 'name': song.album, 'artist': song.artist },
          function(results, constraint) {
            if (!results.length) {
              album = new Album(albumInsertId++, constraint.name, constraint.artist);
              albums.push(album);
            }
          });

        // Add the genre if it doesn't exist
        exports.getByProperties(exports.getGenres(), { 'name': song.genre },
          function(results, constraint) {
            if (!results.length) {
              genre = new Genre(genreInsertId++, constraint.name);
              genres.push(genre);
            }
          });

        songsCovered++;
        songs.push(song);
        stream.destroy();

        // Once each song in a dir has been completed
        if (songsCovered == numSongs)
          songCallback();
      });
    }
  }, function(err) {});
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

// Returns an array of all artists in the library
exports.getArtists = function() {
  return artists;
};

// Returns an array of all albums in the library
exports.getAlbums = function() {
  return albums;
};

// Returns an array of all genres in the library
exports.getGenres = function() {
  return genres;
};

// Returns an array of all songs in the library
exports.getSongs = function() {
  return songs;
};

// Uses Binary Search to return an object from one of songs, artists, albums 
// or genres, based on its id
exports.getById = function(array, id, callback) {
  return (function binarySearch(low, high) {
    if (high < low)
      return callback(null);

    var mid = Math.floor((low + high) / 2);

    if (array[mid].id > id) {
      return process.nextTick(binarySearch.bind(null, low, mid - 1));
    } else if (array[mid].id < id) {
      return process.nextTick(binarySearch.bind(null, mid + 1, high));
    } else {
      // Return a copy of the object
      return callback(JSON.parse(JSON.stringify(array[mid])));
    }
  }(0, array.length - 1));
};

// Uses Sequential Search on an array (one of songs, artists, albums or genres), 
// and returns an array of objects such that they have the properties supplied.
// Example Usage: 
// getByProperties(songs, { 'genre': 'country', 'album': 'Unspecified' }, callback)
exports.getByProperties = function(array, properties, callback) {
  return (function compare(i, results) {
    if (i >= array.length)
      return callback(results, properties);

    var match = true;
    for (var key in properties) {
      if (array[i][key] !== properties[key]) {
        match = false;
        break;
      }
    }

    // Push copies of if the object met the criteria
    if (match)
      results.push(JSON.parse(JSON.stringify(songs[i])));

    return process.nextTick(compare.bind(null, i+1, results));
  }(0, []));
};
