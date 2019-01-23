// Wrap to not pollute in browsers
(function(factory) {

  if (('function' === typeof define) && require.amd) {
    // RequireJS
    define(['tankdb'],factory);
  } else if ('object' === typeof module) {
    // CommonJS / NodeJS / Browserify
    let tank;
    try { tank = tank || require('tankdb'); } catch(e) {}
    try { tank = tank || require('../../tank'); } catch(e) {}
    module.exports = factory(tank);
  } else if ('object' === typeof window) {
    // Browser export
    factory(window.TankDB);
  } else {
    // Unknown environment
    throw new Error('TankDB is not supported in this environment');
  }

})(function(Tank) {

  // SRC: https://npmjs.com/package/protocols
  function protocols( input, first ) {
    if (first === true) first = 0;
    let index  = input.indexOf("://"),
        splits = input.substring(0, index).split('+').filter(Boolean);
    if (typeof first === 'number') {
      return splits[first];
    }
    return splits;
  }

  // Starting of a websocket server
  Tank.on('create', function(next) {
    next();

    // We don't support servers in the browser
    if ('object' === typeof window) return;

    // Prevent unintended server
    let ctx = this._.root;
    if ( ctx._.opts.ws === false ) return;

    // Ensure there's a peer list
    if (!ctx._.opts.peers) ctx._.opts.peers = [];

    // Fetch the websocket lib to use
    let WebSocket = ctx._.opts.WebSocket || require('cws');
    if (!WebSocket) return;

    // Handle given port
    if ('number' === typeof ctx._.opts.ws) {
      let port = ctx._.opts.ws;
      ctx._.opts.ws = {server: require('http').createServer()};
      ctx._.opts.ws.server.listen(port);
    }

    // Ensure WS is an object
    if ('object' !== typeof ctx._.opts.ws) {
      ctx._.opts.ws = {};
    }

    // Ensure we have a server
    if (!ctx._.opts.ws.server) {
      ctx._.opts.ws.server = require('http').createServer();
      ctx._.opts.ws.server.listen(1332);
    }

    // Let's create our WS server
    let wss = ctx._.opts.ws.wss = new WebSocket.Server(ctx._.opts.ws);

    // Handle incoming connections
    // 'out' event is not listened on because sockets have .send method
    wss.on('connection', function connection(socket) {
      ctx._.opts.peers.push(socket);
      socket.on('message', function incoming(msg) {
        ctx.in(msg);
      });
    });
  });

  // Starting of a websocket client
  Tank.on('opt', function(next) {

    // Ensure context & peer list
    let ctx = this._.root;
    if (!ctx._.opts.peers) ctx._.opts.peers = [];

    // Get the websocket library
    let WebSocket = ctx._.opts.WebSocket || ( 'object' === typeof window ? window.WebSocket : false ) || require('cws');
    if (!WebSocket) return;

    // Connect to all websocket urls in the peer list
    ctx._.opts.peers.forEach(function( peer, index ) {
      if ('string' !== typeof peer) return;
      let url   = peer;
      let prots = protocols(url);
      if (!(~prots.indexOf('ws')||~prots.indexOf('wss'))) return;
      function reconnect() {
        if ('object' === typeof peer) {
          if (peer.ignore) return;
          peer.ignore = true;
          (peer.ws.terminate||peer.ws.close)();
        }
        peer = ctx._.opts.peers[index] = {
          queue: [],
          send : function(msg) {
            if (peer.ws.readyState !== 1) return peer.queue.push(msg);
            while(peer.queue.length) peer.ws.send(peer.queue.shift());
            peer.ws.send(msg);
          },
          ws: new WebSocket(url),
        };
        peer.ws.onopen = function() {
          while( peer.queue.length ) peer.ws.send(peer.queue.shift());
        };
        peer.ws.onclose = reconnect;
        peer.ws.onmessage = function(ev) {
          let msg = ev && ev.data || ev;
          ctx.in(msg);
        };
        peer.ws.onerror   = function(err) {
          if (!err) return;
          if (err.code === 'ECONNREFUSED') return reconnect();
        };
      }
      reconnect();
    });
    next();
  });

});
