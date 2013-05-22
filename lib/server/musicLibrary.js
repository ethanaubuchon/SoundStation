var fs = require('fs');
var mm = require('musicmetadata');
var async = require('async');
var lame = require('lame');
var speaker = require('speaker');

var songs = [];
var insertId = 1;
var stream;

// Function to recurse through a directory, looking for songs to add
// Evokes callback() whenever all songs in a directory have been processed
// Consider rewriting later to make fully async
exports.addToLibrary = function(dir, songCallback) {
  // Get all files and folders in directory
  var list = fs.readdirSync(dir);

  var numSongs = 0;
  var songsCovered = 0;

  async.each(list, function(file, callback) {
    var path = dir + '/' + file;

    // If it's a directory, then use recursion
    var stat = fs.statSync(path);
    if (stat && stat.isDirectory()) {
      exports.addToLibrary(path, songCallback);
    }

    // If it's a song, parse its data
    else if (path.split('.').pop().toLowerCase() == 'mp3') {
      numSongs++;

      // If it's an MP3, get its meta-data
      var stream = fs.createReadStream(path);
      var parser = new mm(stream);

      // Iterate through desired data and listen for their events
      var songInfo = { 'songPath' : path };
      var metaData = ['artist', 'album', 'title', 'year', 'genre'];

      // Collect meta-data
      async.each(metaData,
        function(attr, callback) {
          var key = attr;
          parser.on(attr, function (result) {
            if (result instanceof Array)
              songInfo[attr] = result[0];
            else
              songInfo[attr] = result;
          });
      }, function(err) {});

      // Kill the stream when parsing is done
      parser.on('done', function (err) {
        songsCovered++;
        songInfo['id'] = insertId++;
        songs.push(songInfo);
        stream.destroy();

        // Once each song in a dir has been completed
        if (songsCovered == numSongs)
          songCallback();
      });
    }
  }, function(err) {});
};

exports.getSongs = function() {
  return songs;
};

exports.getSongById = function(id, callback) {
  // Binary search
  return (function binarySearch(low, high) {
    if (high < low) {
      return callback(null);
    }

    var mid = Math.floor((low + high) / 2);

    if (songs[mid].id > id) {
      return process.nextTick(binarySearch.bind(null, low, mid - 1));
    }
    else if (songs[mid].id < id) {
      return process.nextTick(binarySearch.bind(null, mid + 1, high));
    }
    else {
      return callback(songs[mid]);
    }
  }(0, songs.length - 1));
};

exports.getSongsByAttr = function(attr, value, callback) {
  // Sequential search
  return (function compare(i, results) {
    if (i >= songs.length) {
      return callback(results);
    }
    if (songs[i][attr] == value) {
      results.push(songs[i]);
    }

    return process.nextTick(compare.bind(null, i+1, results));
  }(0, []));
};

exports.playSong = function(id) {
  exports.getSongById(id, function(song) {
    if (song !== null) {
      stream = fs.createReadStream(song.songPath);
      stream.pipe(new lame.Decoder()).pipe(new speaker());
    }
  });
};
