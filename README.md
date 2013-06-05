SoundStation
============

Local network based music player and organizer controlled from a browser or phone. Built with [Node.js](http://nodejs.org/) and [Derby](http://derbyjs.com/). Can be used by DJs, bar owners, and party hosts to allow guests to request/queue songs from their music library.

![screenshot](http://danielstjules.com/soundstation/screenshot.gif)

Installation
------------

	$ git clone https://github.com/ethanaubuchon/SoundStation.git
	$ cd SoundStation/
	$ npm install
	$ mv config.sample.json config.json

Then modify config.json, listing paths for the app to traverse in search of music.

Running the Server
------------------

	$ node server.js

Authors
-------

Created by [Ethan Aubuchon](https://github.com/ethanaubuchon) and [Daniel St. Jules](https://github.com/danielstjules/).
