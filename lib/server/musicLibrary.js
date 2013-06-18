var fs = require('fs');
var mm = require('musicmetadata');
var async = require('async');

var songs = [];
var artists = {};
var albums = {};
var genres = {};

// ID's are determined by insertion order, making for quicker lookups
var insertId = 1;

var artistInsertId = 1;
var albumInsertId = 1;
var genreInsertId = 1;

// Every song will have the properties below
function Song(path) {
  this.id     = 0;
  this.path   = path;
  this.title  = '';
  this.artist = '';
  this.album  = 'Unspecified';
  this.genre  = 'Unspecified';
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
      var song = new Song(path);
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

        // Update artists, albums and genres hashes
        if (!artists[song.artist])
          artists[song.artist] = artistInsertId++;

        if (!albums[song.album])
          albums[song.album] = albumInsertId++;

        if (!genres[song.genre])
          genres[song.genre] = genreInsertId++;

        songsCovered++;
        song.id = insertId++;
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
getTitleFromPath = function(path) {
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
getArtistFromPath = function(path) {
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
  var artistsArray = [];
  for (var key in artists) {
    artistsArray.push({ 'id': artists[key], 'name': key });
  }

  return artistsArray;
};

// Returns an array of all albums in the library
exports.getAlbums = function() {
  var albumsArray = [];
  for (var key in albums) {
    albumsArray.push({ 'id': albums[key], 'name': key });
  }

  return albumsArray;
};

// Returns an array of all genres in the library
exports.getGenres = function() {
  var genresArray = [];
  for (var key in genres) {
    genresArray.push({ 'id': genres[key], 'name': key });
  }

  return genresArray;
};

// Returns an array of all songs in the library
exports.getSongs = function() {
  return songs;
};

// Uses Binary Search to return a song object given its id
exports.getSongById = function(id, callback) {
  return (function binarySearch(low, high) {
    if (high < low)
      return callback(null);

    var mid = Math.floor((low + high) / 2);

    if (songs[mid].id > id) {
      return process.nextTick(binarySearch.bind(null, low, mid - 1));
    } else if (songs[mid].id < id) {
      return process.nextTick(binarySearch.bind(null, mid + 1, high));
    } else {
      // Return a copy of the object
      return callback(JSON.parse(JSON.stringify(songs[mid])));
    }
  }(0, songs.length - 1));
};

// Uses Sequential search to get all songs with a matching attribute value
// Returns an array of all matching song objects
exports.getSongsByAttr = function(attr, value, callback) {
  return (function compare(i, results) {
    if (i >= songs.length)
      return callback(results);

    // Push copies of the song objects
    if (songs[i][attr] == value)
      results.push(JSON.parse(JSON.stringify(songs[i])));

    return process.nextTick(compare.bind(null, i+1, results));
  }(0, []));
};
