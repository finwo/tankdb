// Load ws lib & leveldb storage
const WS        = require('cws'),
      autolevel = require('autolevel'),
      level     = autolevel('dir://data/');

// Setup http server
const ecstatic = require('ecstatic');
const http     = require('http');
const server   = http.createServer(ecstatic(`${__dirname}/public`));
server.listen(10666, function(err) {
  if (err) throw err;
  console.log('Server listening on :10666');
});

// Load the db
const Tank = require('../tank');
require('../lib/adapter/websocket');
require('../lib/adapter/level');

// Setup the db
const db = Tank({
  node      : 'server',
  level     : level,
  ws        : {server},
  WebSocket : require('ws-rc4')(process.env.KEY),
});

