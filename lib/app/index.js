var derby = require('derby');
derby.use(require('../../ui'));

var app = derby.createApp(module);
var get = app.get;
var view = app.view;

// ROUTES //

app.get('/', function(page, model) {
  model.subscribe('songs', 'currentSong', 'queue', function() {
    page.render('home');
  });
});

// CONTROLLER FUNCTIONS //

// Takes an array of objects (songs) and adds their position in the array 
// as an attribute. We use this as their unique id while in the queue
view.fn('addPosition', function(jsonArray) {
  for (var i = 0; i < jsonArray.length; i++) {
    jsonArray[i]['position'] = i;
  }
  return jsonArray;
});
