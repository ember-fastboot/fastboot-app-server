'use strict';

var path = require('path');
var alchemistRequire = require('broccoli-module-alchemist/require');
var FastBootAppServer = alchemistRequire('fastboot-app-server');

var server = new FastBootAppServer({
  distPath: path.resolve(__dirname, './basic-app'),
  assetsCacheControl: 'max-age=365000000, immutable'
});

server.start();
