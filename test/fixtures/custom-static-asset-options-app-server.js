'use strict';

var path = require('path');
var alchemistRequire = require('broccoli-module-alchemist/require');
var FastBootAppServer = alchemistRequire('fastboot-app-server');

var server = new FastBootAppServer({
  distPath: path.resolve(__dirname, './basic-app'),
  staticAssetOptions: {
    maxAge: '3650d',
    setHeaders: function (res, path, stat) {
      res.set('x-test-path', path);
      res.set('x-test-stat', JSON.stringify(stat));
    }
  }
});

server.start();
