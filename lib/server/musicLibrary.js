var fs = require('fs');
var mm = require('musicmetadata');
var async = require('async');
var lame = require('lame');
var speaker = require('speaker');
var eventEmitter = require('events').EventEmitter;

var songs = [];
var queue = [];

// The Current Song and streams
var currentSong = null;
var stream;
var speakerInstance;

// Song object id's are determined by insertion order
var insertId = 1;

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
    if (stat && stat.isDirectory()) {
      exports.addToLibrary(path, songCallback);
    }
    // If it's an MP3, get its meta-data
    else if (path.split('.').pop().toLowerCase() == 'mp3') {
      numSongs++;

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

      // Kill the stream when parsing is done, add the song to the library
      parser.on('done', function (err) {
        // If title or artist aren't set, use the song's path to guess
        if (!songInfo['title']) {
          songInfo['title'] = getTitleFromPath(songInfo['songPath']);
        }
        if (!songInfo['artist']) {
          songInfo['artist'] = getArtistFromPath(songInfo['songPath']);
        }
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

// Calls end on the current speaker to stop the song
endSpeaker = function() {
  if (currentSong) {
    currentSong['autoPlayNext'] = false;
    currentSong['playing'] = false;
  }

  // Don't call end() on speakerInstance directly. 
  // This is to avoid calling end() on the wrong object
  var speakerToClose = speakerInstance;
  try {
    speakerToClose.end();
  } catch(error) {
    // Do nothing
  }
};

// Returns the current song, or null if no song is playing
exports.getCurrentSong = function() {
  return currentSong;
};

// Returns the current song queue as an array of song objects
exports.getQueue = function() {
  return queue;
};

// Returns an array of all songs in the library
exports.getSongs = function() {
  return songs;
};

// Returns true if there's a song currently selected, false otherwise
exports.hasCurrent = function() {
  return currentSong !== null;
};

// Returns true if a song a is currently playing, and if not, false
exports.isPlaying = function() {
  if (currentSong && currentSong['playing'])
      return true;
  return false;
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
      return callback(songs[mid]);
    }
  }(0, songs.length - 1));
};

// Uses Sequential search to get all songs with a matching attribute value
// Returns an array of all matching song objects
exports.getSongsByAttr = function(attr, value, callback) {
  return (function compare(i, results) {
    if (i >= songs.length)
      return callback(results);

    if (songs[i][attr] == value)
      results.push(songs[i]);

    return process.nextTick(compare.bind(null, i+1, results));
  }(0, []));
};

// Given a song id, adds that song to the queue to be played later
exports.queueSong = function(id, callback) {
  exports.getSongById(id, function(song) {
    if (song !== null) {
      queue.push(song);
      callback();
    }
  });
};

// Given a song id, sets that song as the current song and starts playing it
// Also listens for when speakerInstance.end() is called and starts playing the 
// next song in the queue if autoPlayNext is set to true. 
// Note: It ends any currently playing song
exports.playSong = function(id, callback) {
  endSpeaker();
  setTimeout(exports.getSongById(id, function(song) {
    if (song !== null) {
      currentSong = song;
      currentSong['autoPlayNext'] = true;
      currentSong['playing'] = true;
      callback();

      var originalSong = currentSong;

      stream = fs.createReadStream(song.songPath);
      speakerInstance = new speaker();
      stream.pipe(new lame.Decoder()).pipe(speakerInstance);

      speakerInstance.on('flush', function(stream) {
        playing = false;
        if (currentSong['autoPlayNext'] && originalSong == currentSong) {
          exports.playNext(callback);
        }
        callback();
      });
    }
  }), 100);
};

// Given a song id, uses playSong if no song is currently playing, otherwise
// it adds the song to the queue
exports.playOrQueueSong = function(id, callback) {
  // If a song is playing, add it to the queue, otherwise start playing it
  if (!currentSong)
    exports.playSong(id, callback);
  else
    exports.queueSong(id, callback);
};

// Removes a song from the queue given its position
exports.removeSongFromQueue = function(position, callback) {
  if (queue[position] !== null)
    queue.splice(position, 1);

  callback();
};

// Given a position in the queue, shifts that song up by one
exports.moveUpInQueue = function(position, callback) {
  if (queue[position] && position > 0) {
    var tempSong = queue[position-1];
    queue[position-1] = queue[position];
    queue[position] = tempSong;
  }

  callback();
};

// Given a position in the queue, shifts that song down by one
exports.moveDownInQueue = function(position, callback) {
  var dest = parseInt(position, 10) + 1;
  if (queue[position] && queue[dest] && dest < queue.length) {
    var tempSong = queue[dest];
    queue[dest] = queue[position];
    queue[position] = tempSong;
  }

  callback();
};

// Given a song id, replaces the currently playing song and immediately plays it
exports.playNow = function(id, callback) {
  exports.playSong(id, callback);
};

// Shifts a song from the queue if it's not empty, and calls playSong
exports.playNext = function(callback) {
  if (queue.length > 0) {
    currentSong = queue.shift();
    exports.playSong(currentSong.id, callback);
  }
  else {
    endSpeaker();
    callback();
  }
};

// Stops the currentSong and plays the next song in the queue
exports.nextSong = function(callback) {
  exports.playNext(callback);
};

// Probably stops the song
exports.stopSong = function() {
  endSpeaker();
};
