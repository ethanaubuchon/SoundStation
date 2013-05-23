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
