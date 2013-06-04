var derby = require('derby');
derby.use(require('../../ui'));

var app = derby.createApp(module);
var get = app.get;
var view = app.view;

// ROUTES //

app.get('/', function(page, model) {
  model.subscribe('songs', 'currentSong', 'queue', 'playing', 'shuffle', function() {
    page.render('home', {
      'isAdmin': model["session"]["isAdmin"],
      'homePage': 'active',
      'sessionID': model['req']['sessionID']
    });
  });
});

app.get('/artists/', function(page, model) {
  model.subscribe('artists', 'currentSong', 'queue', 'playing', 'shuffle', function() {
    page.render('artists', {
      'isAdmin': model["session"]["isAdmin"],
      'artistPage': 'active',
      'sessionID': model['req']['sessionID']
    });
  });
});

app.get('/artist/:id', function (page, model, params) {
  var artistPath = 'artist'+params.id;
  model.subscribe(artistPath, 'currentSong', 'queue', 'playing', 'shuffle', function(err, artist) {
    // TODO: Use ref for artistPath
    page.render('songs', {
      'isAdmin': model["session"]["isAdmin"],
      'artistPage': 'active',
      'sessionID': model['req']['sessionID'],
      'songs': model.get(artistPath)
    });
  });
});

app.get('/albums/', function(page, model) {
  model.subscribe('albums', 'currentSong', 'queue', 'playing', 'shuffle', function() {
    page.render('albums', {
      'isAdmin': model["session"]["isAdmin"],
      'albumPage': 'active',
      'sessionID': model['req']['sessionID']
    });
  });
});

app.get('/album/:id', function (page, model, params) {
  var albumPath = 'album'+params.id;
  model.subscribe(albumPath, 'currentSong', 'queue', 'playing', 'shuffle', function(err, artist) {
    // TODO: Use ref for albumPath
    page.render('songs', {
      'isAdmin': model["session"]["isAdmin"],
      'albumPage': 'active',
      'sessionID': model['req']['sessionID'],
      'songs': model.get(albumPath)
    });
  });
});

app.get('/genres/', function(page, model) {
  model.subscribe('genres', 'currentSong', 'queue', 'playing', 'shuffle', function() {
    page.render('genres', {
      'isAdmin': model["session"]["isAdmin"],
      'genrePage': 'active',
      'sessionID': model['req']['sessionID']
    });
  });
});

app.get('/genre/:id', function (page, model, params) {
  var genrePath = 'genre'+params.id;
  model.subscribe(genrePath, 'currentSong', 'queue', 'playing', 'shuffle', function(err, artist) {
    // TODO: Use ref for albumPath
    page.render('songs', {
      'isAdmin': model["session"]["isAdmin"],
      'genrePage': 'active',
      'sessionID': model['req']['sessionID'],
      'songs': model.get(genrePath)
    });
  });
});

// CONTROLLER FUNCTIONS //

// Helper to check if two values are equal
view.fn('equal', function(a, b) {
  return (a == b);
});

// Takes an array of objects (songs) and adds their position in the array 
// as an attribute. We use this as their unique id while in the queue
view.fn('addPosition', function(jsonArray) {
  for (var i = 0; i < jsonArray.length; i++) {
    jsonArray[i]['position'] = i;
  }
  return jsonArray;
});

// Given a song's voteIDs attribute and a user's sessionID, returns true if 
// that user has voted for the song already and false otherwise
view.fn('hasVoted', function(voteIDs, sessionID) {
  if (!voteIDs || !voteIDs.length)
    return false;

  for (var i = 0; i < voteIDs.length; i++) {
    if (voteIDs[i] == sessionID)
      return true;
  }

  return false;
});
