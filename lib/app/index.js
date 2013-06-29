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
      'sessionID': model['req']['sessionID'],
      'page' : 1
    });
  });
});

app.get('/:id(\\d+)/', function(page, model, params) {
  model.subscribe('songs', 'currentSong', 'queue', 'playing', 'shuffle', function() {
    page.render('home', {
      'isAdmin': model["session"]["isAdmin"],
      'homePage': 'active',
      'sessionID': model['req']['sessionID'],
      'page': params.id
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

app.get('/artist/:id', function(page, model, params) {
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

app.get('/album/:id', function(page, model, params) {
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

app.get('/genre/:id', function(page, model, params) {
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

// HELPERS //

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

// Returns a subset of an array based on the current page id
view.fn('paginate-array', function(array, page, itemLimit) {
  var paginatedArray = [];
  var startingIndex = itemLimit * page - itemLimit;
  var maxIndex = startingIndex + itemLimit;

  if (startingIndex + itemLimit > array.length)
    maxIndex = array.length;

  // Return if the limit is greater than the size of the array
  if (!array || array.length < itemLimit)
    return array;

  // Return if the page exceeds the array size
  if (array.length < startingIndex)
    return paginatedArray;

  for (var i = startingIndex; i < maxIndex; i++) {
    paginatedArray.push(array[i]);
  }

  return paginatedArray;
});

// Returns an array of page numbers given an array. Used to display the 
// pagination for a paginated array
view.fn('paginate-pages', function(array, itemLimit) {
  var pages = [1];

  // Return if the array is smaller than the limit
  if (!array || array.length < itemLimit)
    return pages;

  for (var i = 1; i < array.length / itemLimit; i++) {
    pages.push(i + 1);
  }

  return pages;
});
