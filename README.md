SoundStation
============

Local network based music player and organizer controlled from a browser or phone. Built with [Node.js](http://nodejs.org/) and [Derby](http://derbyjs.com/). Can be used by DJs, bar owners, and party hosts to allow guests to request/queue songs from their music library.

![screenshot](http://danielstjules.com/soundstation/screenshot.jpg)

Installation Requirements
-------------------------

If you haven't already installed Node.js, you can download it from http://nodejs.org/download/

**Unix:**

  * node-gyp recommends python 2.7.x (3.x.x not supported) You can download 2.7.5 from http://www.python.org/download/releases/2.7.5/#download
  * You'll also need a C/C++ compiler such as GCC (gcc/g++) and GNU make

**Windows Users:** 

  * node-gyp recommends that Python 2.7.x be installed. You can download and run either the *[Windows x86 MSI Installer (2.7.5)](http://www.python.org/ftp/python/2.7.5/python-2.7.5.msi)* or *[Windows X86-64 MSI Installer (2.7.5)](http://www.python.org/ftp/python/2.7.5/python-2.7.5.amd64.msi)* (For 64-bit Windows) from http://www.python.org/download/releases/2.7.5/#download
  * A second requirement is that Visual Studio C++ 2010 or Visual C++ 2010 Express be installed. You can download the Express version at the following page: http://www.microsoft.com/visualstudio/eng/downloads To download the file directly, click [here](http://go.microsoft.com/?linkid=9709949).

Installation
------------

    $ git clone https://github.com/ethanaubuchon/SoundStation.git
    $ cd SoundStation/
    $ npm install
    $ mv config.sample.json config.json


Modifying config.json
---------------------

After installation, your config.json should look like this:

    {
      "directories": ["/path/to/dir", "path/to/another"],
      "secret": "Your Session Secret",
      "pin": "1234",
      "enableVotingOrder": true 
    }

  * *directories*: An array of paths to folders to look for mp3 files
  * *secret*: A secret string unique to your project to sign cookies with
  * *pin*: A pin used to login to the application as an admin user *Warning: Stored in plaintext, so don't reuse a password*
  * *enableVotingOrder*: If set to true, queued songs will be in descending order of votes

Note: Passwords are not currently salted and hashed using node's crypto module. To keep the application as lightweight as possible, the entire config is currently stored in plaintext within the project directory (thus not requiring a DB). If we were to eventually force an installation process on startup, we could then securely store the pin.

Running the Server
------------------

    $ node server.js

Authors
-------

Created by [Ethan Aubuchon](https://github.com/ethanaubuchon) and [Daniel St. Jules](https://github.com/danielstjules/).
