"use strict";

const path              = require('path');
const fork              = require('child_process').fork;
const expect            = require('chai').expect;
const FastBootAppServer = require('../src/fastboot-app-server');
const request           = require('request-promise').defaults({ simple: false, resolveWithFullResponse: true });
const http              = require('http');
const fs                = require('fs');

let server;
let pipe = "";
if (process.platform === "win32") {
    pipe = '\\\\.\\pipe\\testpipe';
} else {
    pipe = 'test.pipe';
}

describe("FastBootAppServer", function() {
  this.timeout(3000);

  afterEach(function() {
    if (server) {
      server.kill();
    }
    if (process.platform !== "win32") {
      // must clean up pipe because server was killed, not closed
      if (fs.existsSync(pipe)) {
        fs.unlink(pipe);
      }
    }
});

  it("throws if no distPath or downloader is provided", function() {
    expect(() => {
      new FastBootAppServer();
    }).to.throw(/must be provided with either a distPath or a downloader/);
  });

  it("throws if both a distPath and downloader are provided", function() {
    expect(() => {
      new FastBootAppServer({
        downloader: {},
        distPath: 'some/dist/path'
      });
    }).to.throw(/FastBootAppServer must be provided with either a distPath or a downloader option, but not both/);
  });

  it("throws if both a path and port are provided", function() {
    expect(() => {
      new FastBootAppServer({
        distPath: 'some/dist/path',
        path: 'tmp/unix.sock',
        port: 3000
      });
    }).to.throw(/FastBootAppServer must be provided with either an IPC path or a port option, but not both/);
  });

  it("serves an HTTP 500 response if the app can't be found", function() {
    return runServer('not-found-server')
      .then(() => request('http://localhost:3000'))
      .then(response => {
        expect(response.statusCode).to.equal(500);
        expect(response.body).to.match(/No Application Found/);
      });
  });

  it("serves static assets", function() {
    return runServer('basic-app-server')
      .then(() => request('http://localhost:3000/assets/fastboot-test.js'))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('"use strict";');
      })
      .then(() => request('http://localhost:3000/'))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("returns a 404 status code for non-existent assets",  function() {
    return runServer('basic-app-server')
      .then(() => request('http://localhost:3000/assets/404-does-not-exist.js'))
      .then(response => {
        expect(response.statusCode).to.equal(404);
        expect(response.body).to.match(/Not Found/);
      })
      .then(() => request('http://localhost:3000/'))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("executes beforeMiddleware", function() {
    return runServer('before-middleware-server')
      .then(() => request('http://localhost:3000'))
      .then(response => {
        expect(response.statusCode).to.equal(418);
        expect(response.headers['x-test-header']).to.equal('testing');
        expect(response.body).to.equal(JSON.stringify({ send: 'json back'}));
      });
  });

  it("executes afterMiddleware when there is an error", function() {
    return runServer('after-middleware-server')
      .then(() => request('http://localhost:3000'))
      .then(response => {
        expect(response.body).to.not.match(/error/);
        expect(response.headers['x-test-header']).to.equal('testing');
      });
  });

  it("returns a 401 status code for non-authenticated request", function() {
    return runServer('auth-app-server')
      .then(() => request('http://localhost:3000/'))
      .then(response => {
        expect(response.statusCode).to.equal(401);
        expect(response.headers['www-authenticate']).equal('Basic realm=Authorization Required');
      })
      .then(() => request({ uri: 'http://localhost:3000/', headers: { 'Authorization': 'Basic dG9tc3Rlcjp6b2V5'  }}))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("responds on the configured host and port", function() {
    return runServer('ipv4-app-server')
      .then(() => request('http://127.0.0.1:4100/'))
      .then((response) => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("responds on the configured IPC path", function() {
    let requestOptions = {
      socketPath: pipe,
      method: 'GET',
      path:'/'
    };
    return runServer('ipc-app-server')
      .then(() => httpIpcRequest(requestOptions))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        return httpIPCResponseData(response);
      })
      .then(data => {
        let body = data.toString();
        expect(body).to.contain('Welcome to Ember');
      });
  });

  it("allows setting sandbox globals", function() {
    return runServer('sandbox-globals-app-server')
      .then(() => request('http://localhost:3000/'))
      .then((response) => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember from MY GLOBAL!');
      });
  });
});

function httpIpcRequest(options) {
  return new Promise(function (resolve, reject) {
    let req = http.request(options);
    req.on('response', (response) => {
      resolve(response);
    });
    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}
function httpIPCResponseData(response) {
  return new Promise(function (resolve, reject) {
    response.on('data', function(chunk) {
      resolve(chunk);
    });
  });
}

function runServer(name) {
  return new Promise((res, rej) => {
    let serverPath = path.join(__dirname, 'fixtures', `${name}.js`);
    server = fork(serverPath, {
      silent: true
    });

    server.on('error', rej);

    server.stdout.on('data', data => {
      if (data.toString().match(/HTTP server started/)) {
        res();
      }
    });

    server.stderr.on('data', data => {
      console.log(data.toString());
    });

    server.stdout.on('data', data => {
      console.log(data.toString());
    });
  });
}
