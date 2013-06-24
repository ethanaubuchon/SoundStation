var http = require('http');
var path = require('path');
var express = require('express');
var gzippo = require('gzippo');
var derby = require('derby');
var app = require('../app');
var serverError = require('./serverError');
var musicLibrary = require('./musicLibrary');
var musicPlayer = require('./musicPlayer');
var config = require(homeDir + '/config.json');
var async = require('async');

// SERVER CONFIGURATION //

var expressApp = express();
var server = module.exports = http.createServer(expressApp);

derby.use(derby.logPlugin);
var store = derby.createStore({listen: server});

var model = store.createModel();

var ONE_YEAR = 1000 * 60 * 60 * 24 * 365;
var root = path.dirname(path.dirname(__dirname));
var publicPath = path.join(root, 'public');

expressApp
  .use(express.favicon())
  // Gzip static files and serve from memory
  .use(gzippo.staticGzip(publicPath, {maxAge: ONE_YEAR}))
  // Gzip dynamically rendered content
  .use(express.compress())

  .use(express.bodyParser())
  .use(express.methodOverride())

  // Derby session middleware creates req.model and subscribes to _session
  .use(express.cookieParser())
  .use(store.sessionMiddleware({
    secret: process.env.SESSION_SECRET || config.secret,
    cookie: {maxAge: ONE_YEAR, httpOnly: false}
  }))

  // Adds req.getModel method
  .use(store.modelMiddleware())
  // Creates an express middleware from the app's routes
  .use(app.router())
  .use(expressApp.router)
  .use(serverError(root));

// Build Music Library //

var musicDirs = config.directories;

if (config.enableVotingOrder)
  musicPlayer.enableVotingOrder();

function updateArtists(artist) {
  var constraint = { 'artist': artist.name };
  musicLibrary.getByProperties(musicLibrary.songs, constraint, function(results) {
      model.set('artist' + artist.id, results);
  });
}

function updateAlbums(album) {
  var constraint = { 'album': album.name, 'artist': album.artist };
  musicLibrary.getByProperties(musicLibrary.songs, constraint, function(results) {
    model.set('album' + album.id, results);
  });
}

function updateGenres(genre) {
  var constraint = { 'genre': genre.name };
  musicLibrary.getByProperties(musicLibrary.songs, constraint, function(results) {
    model.set('genre' + genre.id, results);
  });
}

function updateLibrary() {
  var artists = musicLibrary.artists;
  var albums = musicLibrary.albums;
  var genres = musicLibrary.genres;

  model.set('artists', artists);
  model.set('albums', albums);
  model.set('genres', genres);
  model.set('songs', musicLibrary.songs);

  // Update the songs for each artist, album and genre
  async.each(artists, updateArtists, function(err){});
  async.each(albums, updateAlbums, function(err){});
  async.each(genres, updateGenres, function(err){});
}

function updatePlayer() {
  model.set('queue', musicPlayer.getQueue());
  model.set('playing', musicPlayer.isPlaying());
  model.set('shuffle', musicPlayer.isShuffleOn());

  if (musicPlayer.hasCurrent())
    model.set('currentSong', musicPlayer.getCurrentSong());
}

musicDirs.forEach(function(directory) {
  musicLibrary.addToLibrarySync(directory, updateLibrary);
});

// SERVER ONLY ROUTES //
// 
// All server routes update the model by calling updatePlayer() and redirect back 
// to home. The user isn't expected to access them directly, but instead the 
// client performs GET requests on the routes using Ajax. Furthermore, all routes 
// except for /login, /logout, /vote and /play require the user to be authenticated

// Returns whether or not the user is logged in
function isAdmin(req) {
  return (req.getModel().session.isAdmin);
}

// Attempt to login using the pin defined in config.json
expressApp.post('/login', function(req, res) {
  if (req.body.pin && req.body.pin == config.pin) {
    session = req.getModel().session;
    session.isAdmin = true;
  }
  res.redirect('/');
});

// Log out by setting isAdmin to false
expressApp.post('/logout', function(req, res) {
  session = req.getModel().session;
  session.isAdmin = false;
  res.redirect('/');
});

expressApp.get('/addAll/:type(artist|album|genre)/:id', function(req, res) {
  if (!isAdmin(req)) {
    res.redirect('/');
    return;
  }

  var type = req.params.type;
  var id = req.params.id;
  var array;

  if (type === 'artist') array = musicLibrary.artists;
  else if (type === 'genre') array = musicLibrary.genres;
  else if (type === 'album') array = musicLibrary.albums;
  else return;

  musicLibrary.getById(array, req.params.id, function(t){
    if (t) {
      var properties = {};
      properties[type] = t.name;

      // If we're getting an album, we need to include artist name as well
      if (type === 'album')
        properties['artist'] = t.artist;

      var songs = musicLibrary.songs;
      musicLibrary.getByProperties(songs,properties,function(songArray, p){
        if (songArray) {
          var sessionID = req.getModel().req.sessionID;
          musicPlayer.addAll(songArray, sessionID, updatePlayer);
        }
      });
    }
  });
  res.redirect('/');
});

// Play a song given its id
expressApp.get('/play/:id', function(req, res) {
  var sessionID = req.getModel().req.sessionID;
  musicLibrary.getById(musicLibrary.songs, req.params.id, function(song) {
    musicPlayer.playOrQueueSong(song, sessionID, updatePlayer);
  });
  res.redirect('/');
});

// Play given song immediately (skipping queue)
expressApp.get('/playnow/:id', function(req, res) {
  if (isAdmin(req)) {
    musicLibrary.getById(musicLibrary.songs, req.params.id, function(song) {
      musicPlayer.playNow(song, updatePlayer);
    });
  }
  res.redirect('/');
});

// Play given song immediately (skipping queue, without adding to previous)
expressApp.get('/resume/:id', function(req, res) {
  if (isAdmin(req)) {
    musicLibrary.getById(musicLibrary.songs, req.params.id, function(song) {
      musicPlayer.playSong(song, updatePlayer);
    });
  }
  res.redirect('/');
});

// Stop whatever song is currently playing
expressApp.get('/stop', function(req, res) {
  if (isAdmin(req))
    musicPlayer.stopSong();
  res.redirect('/');
});

// Skip to the next song in the playlist if one is not available
expressApp.get('/next', function(req, res){
  if (isAdmin(req))
    musicPlayer.nextSong(updatePlayer);
  res.redirect('/');
});

// Plays previous song
expressApp.get('/prev', function(req,res){
  if (isAdmin(req))
    musicPlayer.previousSong(updatePlayer);
  res.redirect('/');
});

// Turns shuffle off
expressApp.get('/stopShuffle', function(req, res) {
  if (isAdmin(req))
    musicPlayer.stopShuffle(updatePlayer);
  res.redirect('/');
});

// Turns shuffle on
expressApp.get('/shuffle', function(req, res) {
  if (isAdmin(req))
    musicPlayer.startShuffle(updatePlayer);
  res.redirect('/');
});

// Removes a song from the queue given its queueId
expressApp.get('/remove/:id', function(req, res) {
  if (isAdmin(req))
    musicPlayer.removeSongFromQueue(req.params.id, updatePlayer);
  res.redirect('/');
});

// Moves a song up one position in the queue given the queueId
expressApp.get('/moveup/:id', function(req, res) {
  if (isAdmin(req))
    musicPlayer.moveUpInQueue(req.params.id, updatePlayer);
  res.redirect('/');
});

// Moves a song down one position in the queue given the queueId
expressApp.get('/movedown/:id', function(req, res) {
  if (isAdmin(req))
    musicPlayer.moveDownInQueue(req.params.id, updatePlayer);
  res.redirect('/');
});

// Votes for a song in the queue given its queue id
expressApp.get('/vote/:id', function(req, res) {
  var sessionID = req.getModel().req.sessionID;
  musicPlayer.voteForSongInQueue(req.params.id, sessionID, updatePlayer);
  res.redirect('/');
});

// Handle errors
expressApp.all('*', function(req) {
  throw '404: ' + req.url;
});
