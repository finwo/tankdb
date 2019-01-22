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

    console.log('TODO: FETCH SUPPORTED URLS FROM opts.peers');

    console.log('OPT');
    next();
  });

});
