var fs = require('fs');
var async = require('async');
var lame = require('lame');
var speaker = require('speaker');
var eventEmitter = require('events').EventEmitter;

var queue = [];
var previous = [];

// The Current Song and streams
var currentSong = null;
var stream;
var speakerInstance;
var shuffle = false;

// Whether or not votes should affect queue order
enableVotingOrder = false;

// Calls end on the current speaker to stop the song
endSpeaker = function() {
  if (currentSong) {
    currentSong.autoPlayNext = false;
    currentSong.playing = false;
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

// Adds the song to the queue of previously played songs, and maintains a 
// maximum of 25 songs in its history
addToPrevious = function(song) {
  if (song && (previous.length === 0 || previous[previous.length-1] !== song)) {
    if (previous.length >= 25) previous.shift();
    previous.push(song);
  }
};

// Returns the last played song
getPrevious = function() {
  if (previous.length > 0)
    return previous.pop();
};

// If enableVotingOrder is set to true, then reorder songs in the queue by votes
reorderQueueByVotes = function() {
  if (!enableVotingOrder)
    return;

  queue.sort(function(songA, songB) {
    return songB.votes - songA.votes;
  });
};

// Given a song, find that song's position in the Queue, returns -1 if not found
// Consider making non-blocking
getSongPosition = function(song) {
  for (var i = 0; i < queue.length; i++) {
    if (queue[i].id == song.id)
      return i;
  }

  return -1;
};

// Sets enableVotingOrder to true
exports.enableVotingOrder = function() {
  enableVotingOrder = true;
};

// Returns the current song, or null if no song is playing
exports.getCurrentSong = function() {
  return currentSong;
};

// Returns the current song queue as an array of song objects
exports.getQueue = function() {
  return queue;
};

// Returns true if there's a song currently selected, false otherwise
exports.hasCurrent = function() {
  return currentSong !== null;
};

// Returns true if a song a is currently playing, and if not, false
exports.isPlaying = function() {
  if (currentSong && currentSong.playing)
      return true;
  return false;
};

// Return true if shuffle is currently turned on
exports.isShuffleOn = function() {
  return shuffle;
};

// Given a song, sets it as the current song and starts playing it
// Also listens for when speakerInstance.end() is called and starts playing the 
// next song in the queue if autoPlayNext is set to true. 
// Note: It ends any currently playing song
exports.playSong = function(song, callback) {
  endSpeaker();

  if (song !== null) {
    currentSong = song;
    currentSong.autoPlayNext = true;
    currentSong.playing = true;
    currentSong.startTime = new Date().getTime();

    // Add voting attributes if they don't exist
    if (!currentSong.voteIDs)
      currentSong.voteIDs = [];
    if (!currentSong.votes)
      currentSong.votes = 0;

    callback();

    var originalSong = currentSong;

    stream = fs.createReadStream(song.path);
    speakerInstance = new speaker();
    stream.pipe(new lame.Decoder()).pipe(speakerInstance);

    speakerInstance.on('flush', function(stream) {
      playing = false;
      if (currentSong.autoPlayNext && originalSong === currentSong && !currentSong.repeat)
        exports.playNext(callback);

      currentSong.repeat = false;
      callback();
    });
  }
};

// Probably stops the song
exports.stopSong = function() {
  endSpeaker();
};

// Given a song, adds it to the queue to be played later
exports.queueSong = function(song, sessionID, callback) {
  if (song !== null) {
    var position = getSongPosition(song);
    if (position > -1) {
      exports.voteForSongInQueue(position, sessionID, callback);
    } else {
      song.votes = 1;
      song.voteIDs = [sessionID];
      queue.push(song);
    }
    callback();
  }
};

// Given a song, uses playSong if no song is currently playing, otherwise
// it adds the song to the queue
exports.playOrQueueSong = function(song, sessionID, callback) {
  // If a song is playing, add it to the queue, otherwise start playing it
  if (!currentSong)
    exports.playSong(song, callback);
  else
    exports.queueSong(song, sessionID, callback);
};

// Removes a song from the queue given its position
exports.removeSongFromQueue = function(position, callback) {
  if (queue[position] !== null)
    queue.splice(position, 1);

  callback();
};

// Given a song, replaces the currently playing song and immediately plays it
exports.playNow = function(id, callback) {
  addToPrevious(currentSong);
  exports.playSong(id, callback);
};

// Shifts a song from the queue if it's not empty, and calls playSong
exports.playNext = function(callback) {
  addToPrevious(currentSong);
  if (queue.length > 0) {
    if (shuffle) {
      var position = Math.floor(Math.random() * queue.length);
      currentSong = queue[position];
      queue.splice(position, 1);
    } else {
      currentSong = queue.shift();
    }
    exports.playSong(currentSong, callback);
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

// Plays previous song and pushes current song into the top spot of the queue
exports.previousSong = function(callback) {
  if (currentSong && new Date().getTime() - currentSong.startTime >= 3000) {
    currentSong.repeat = true;
    exports.playSong(currentSong, callback);
  } else {
    var prev = getPrevious();
    if (prev) {
      queue.unshift(currentSong);
      exports.playSong(prev, callback);
    }
  }
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

// Vote for a song in the queue if the user hasn't already voted for it
exports.voteForSongInQueue = function(position, sessionID, callback) {
  if (!queue[position])
    return;

  // Add attributes if they don't exist
  if (!queue[position].voteIDs)
    queue[position].voteIDs = [];
  if (!queue[position].votes)
    queue[position].votes = 0;

  // Check if the user has voted
  var found = false;
  for (var i = 0; i < queue[position].voteIDs.length; i++) {
    if (queue[position].voteIDs[i] == sessionID) {
      found = true;
      break;
    }
  }

  if (!found) {
    queue[position].voteIDs.push(sessionID);
    queue[position].votes += 1;
    reorderQueueByVotes();

    callback();
  }
};

// Turns shuffle songs on
exports.startShuffle = function(callback) {
  shuffle = true;
  callback();
};

// Turns shuffle songs off
exports.stopShuffle = function(callback) {
  shuffle = false;
  callback();
};
