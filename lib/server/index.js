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
}

server.listen(3001, function() {
  updateSongs();
});

musicDirs.forEach(function(directory) {
  musicLibrary.addToLibrary(directory, updateSongs);
});

// SERVER ONLY ROUTES //

// Set music play request routing
expressApp.get('/play/:id', function(req, res) {
  musicLibrary.playSong(req.params.id);
  res.redirect('/');
});

expressApp.all('*', function(req) {
  throw '404: ' + req.url;
});
