'use strict';

var path = require('path');
const FastBootAppServer = require('../../src/fastboot-app-server');

var pipe = "";
if (process.platform === "win32") {
    pipe = '\\\\.\\pipe\\testpipe';
} else {
    pipe = 'test.pipe';
}
var server = new FastBootAppServer({
  path: pipe,
  distPath: path.resolve(__dirname, './basic-app'),
  workerCount: -1
});

server.start();
