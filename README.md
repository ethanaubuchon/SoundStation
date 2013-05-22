SoundStation
============

Local network based music player and organizer controlled from a browser or phone. Built with [Node.js](http://nodejs.org/) and [Derby](http://derbyjs.com/).

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
