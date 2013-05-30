var http = require('http');
var path = require('path');
var express = require('express');
var gzippo = require('gzippo');
var derby = require('derby');
var app = require('../app');
var serverError = require('./serverError');
var musicLibrary = require('./musicLibrary');
var config = require(homeDir + '/config.json');

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

  // Uncomment to add form data parsing support
  // .use(express.bodyParser())
  // .use(express.methodOverride())

  // Uncomment and supply secret to add Derby session handling
  // Derby session middleware creates req.model and subscribes to _session
  // .use(express.cookieParser())
  // .use(store.sessionMiddleware({
  //   secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  // , cookie: {maxAge: ONE_YEAR}
  // }))

  // Adds req.getModel method
  .use(store.modelMiddleware())
  // Creates an express middleware from the app's routes
  .use(app.router())
  .use(expressApp.router)
  .use(serverError(root));

// Build Music Library //

var musicDirs = config['directories'];

function updateSongs() {
  model.set('songs', musicLibrary.getSongs());
  model.set('queue', musicLibrary.getQueue());
  model.set('playing', musicLibrary.isPlaying());
  if (musicLibrary.hasCurrent()) {
    model.set('currentSong', musicLibrary.getCurrentSong());
  }
}

musicDirs.forEach(function(directory) {
  musicLibrary.addToLibrary(directory, updateSongs);
});

// SERVER ONLY ROUTES //
// 
// All server routes update the model by calling updateSongs() and redirect back 
// to home. The user isn't expected to access them directly, but instead the 
// client performs GET requests on the routes using Ajax.

// Play a song given its id
expressApp.get('/play/:id', function(req, res) {
  musicLibrary.playOrQueueSong(req.params.id, updateSongs);
  res.redirect('/');
});

// Play given song immediately (skipping queue)
expressApp.get('/playnow/:id', function(req, res) {
  musicLibrary.playNow(req.params.id, updateSongs);
  res.redirect('/');
});

// Stop whatever song is currently playing
expressApp.get('/stop', function(req, res) {
  musicLibrary.stopSong(updateSongs);
  res.redirect('/');
});

// Skip to the next song in the playlist if one is not available
expressApp.get('/next', function(req, res){
  musicLibrary.nextSong(updateSongs);
  res.redirect('/');
});

// Removes a song from the queue its queueId
expressApp.get('/remove/:id', function(req, res) {
  musicLibrary.removeSongFromQueue(req.params.id,updateSongs);
  res.redirect('/');
});

// Moves a song up one position in the queue give the queueId
expressApp.get('/moveup/:id', function(req, res) {
  musicLibrary.moveUpInQueue(req.params.id,updateSongs);
  res.redirect('/');
});

// Moves a song down one position in the queue give the queueId
expressApp.get('/movedown/:id', function(req, res) {
  musicLibrary.moveDownInQueue(req.params.id,updateSongs);
  res.redirect('/');
});

// Handle errors
expressApp.all('*', function(req) {
  throw '404: ' + req.url;
});
