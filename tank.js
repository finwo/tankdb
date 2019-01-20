// Wrap to not pollute in browsers
(function(factory) {

  if (('function' === typeof define) && require.amd) {
    // RequireJS
    define(factory);
  } else if ('object' === typeof module) {
    // CommonJS / NodeJS / Browserify
    module.exports = factory();
  } else if ('object' === typeof window) {
    // Browser export
    window.TankDB = factory();
  } else {
    // Unknown environment
    throw new Error('TankDB is not supported in this environment');
  }

})(function() {

  // Fetch a reference to global
  let universe = new Function('return this').call();

  // Helper function
  function type( subject ) {
    let orgType = typeof subject;
    switch(orgType) {
      case 'object':
        if ( null === typeof subject ) return 'null';
        if (Array.isArray(subject)) return 'array';
        return 'object';
      default:
        return orgType;
    }
  }

  // Our main constructor
  function Tank(options) {

    // Ensure we're a tank
    if ( this === universe ) {
      return new Tank(options);
    } else {
      if (!(this instanceof Tank)) {
        this.__proto__ = Tank.prototype;
      }
    }

    // Sanity checks
    let opts  = Object.assign({},options),
        fresh = '_' in this;

    // Ensure a fully-built context
    this._ = this._ || {};
    this._ = {
      path : this._.path || [],
      root : this._.root || this,
      opts : this._.opts || opts,
    };

    // Trigger opt on fresh instance
    if (fresh) trigger( this, 'create' );
    return this;
  }

  // Easy in trigger
  Tank.prototype.in = function() {
    trigger( this._.root, 'in', arguments );
    return this;
  };

  // Easy out trigger
  Tank.prototype.out = function() {
    trigger( this._.root, 'out', arguments );
    return this;
  }

  // Following a path
  Tank.prototype.get = function( key ) {
    if ('string' !== typeof key) return this;
    if (!key) return this;
    return Tank.call({_:Object.assign({},this._,{
      path: this._.path.concat(key),
    })});
  };

  // Writing data
  Tank.prototype.put = function( data ) {

    // Non-object data is not supported at the root
    if (this._.path.length <= 1) {
      if ( 'object' !== typeof data ) throw new Error('Non-object data can not be saved at the root');
      if ( !data ) throw new Error('Non-object data can not be saved at the root');
    }

    // Publish everything with the whole path
    // Act as if data is incoming, simplifying local persistent storage
    let tank = this;
    (function recurse( path, data ) {
      // TODO: handle object reference
      Object.keys(data).forEach(function( key ) {
        let fullpath = path.concat(key),
            now      = new Date().getTime();
        switch(type(data[key])) {
          case 'array':
          case 'object':
            tank.in({ '@': now, '#': fullpath, '>': fullpath });
            recurse( fullpath, data[key] );
            break;
          case 'string':
          case 'number':
          case 'null':
            tank.in({ '@': now, '#': fullpath, '=': data[key] });
            break;
        }
      });
    })( this._.path, data );
    return this;
  }

  // Lists of hooks
  let hooks = {};

  // Trigger a hook
  function trigger( ctx, name, args ) {
    if (!(name in hooks)) return;
    let queue = hooks[name].slice();
    (function next() {
      let fn = queue.shift();
      if (!fn) return;
      fn.apply( ctx, [next].concat([].slice.call(arguments)));
    }).apply(null, args);
  }

  // Register an action to a hook
  Tank.on = function( name, handler ) {
    if ('function' !== typeof handler ) return Tank;
    if ('string' !== typeof name ) return Tank;
    if (!handler) return Tank;
    if (!name) return Tank;
    if (!(name in hooks)) hooks[name] = [];
    hooks[name].push(handler);
    return Tank;
  };

  // Run opt on creation
  Tank.on('create', function( next ) {
    trigger( this._.root, 'opt' );
    next();
  });

  // Network deduplication
  // Blocks already-seen messages
  let txdedup = [];
  Tank.on('in', function( next, msg ) {
    let stringified = JSON.stringify(msg);
    if (~txdedup.indexOf(stringified)) return;
    next(msg);
  });
  Tank.on('out', function( next, msg ) {
    let stringified = JSON.stringify(msg);
    txdedup.push(stringified);
    if (txdedup.length > 1000) txdedup.shift();
    next(msg);
  });

  // Network retransmission
  Tank.on('in', function( next, msg ) {
    next(msg);
    // TODO: verify signatures etc
    this.out(msg);
  });

  // Handle storage adapter responses
  let localListeners = {};
  Tank.on('in', function( next, msg ) {
    next(msg);
    if (!msg._) return;
    if (!(msg._ in localListeners)) return;
    let queue = localListeners[msg._];
    localListeners[msg._] = [];
    queue.forEach(function(fn) {
      fn( msg );
    });
  });

  // tank.in({ '@': now, '#': fullpath, '>': fullpath });
  // tank.in({ '@': now, '#': fullpath, '=': data[key] });
  // Store incoming data
  Tank.on('in', function( next, msg ) {
    let ctx = this;
    next(msg);

    // Check if this msg needs processing
    if (msg._) return;
    if (!msg['@']) return;
    if (!msg['#']) return;
    if (!(msg['#']||msg['>'])) return;

    // TODO: follow the path (maybe generate a fresh queue)
    let path  = msg['#'].slice();
    (function next(incomingData) {
      if (!path.length) return;
      let current;

      // Handle incoming data & act accordingly
      if (incomingData) {

        // Refs
        if ( path[0] !== incomingData['_'] ) {
          // Missing = write it
          if (!incomingData['=']) {
            incomingData['='] = JSON.stringify({
              [path[0].split('.').pop()]: [{ '@': new Date().getTime(), '>': path[0] }]
            });
            trigger( ctx, 'put', [ incomingData['_'], incomingData['='] ] );
          }

          // Decode the incoming data
          incomingData['='] = JSON.parse(incomingData['=']);

          // Fetch the latest non-future version
          current = incomingData['='][path[0].split('.').pop()].filter(function(version) {
            return version['@'] <= (new Date().getTime());
          }).pop();

        } else {

          // Missing = write it
          if (!incomingData['=']) {
            incomingData['='] = 'undefined';
            trigger( ctx, 'put', [incomingData['_'],incomingData['=']] );
          }

          // Decode the incoming data
          incomingData['='] = JSON.parse(incomingData['=']);
        }

        // Fowllow any ref
        if (current && current['>']) {
          localListeners[path[0]] = localListeners[path[0]] || [];
          localListeners[path[0]].push(next);
          path[0] = current['>'];
          trigger( ctx, 'get', [path[0]] );
          return;
        }
      }

      // Iterate down if required
      if (path.length>2) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(next);
        trigger( ctx, 'get', [path[0]] );
        let newkey = path.shift() + '.' + path.shift();
        path.unshift(newkey);
        return;
      }

      // Write direct value
      if (path.length === 2) {

        // Yay, direct write, non-merge
        if (!current) {
          // TODO: fetch current whole??
          trigger( ctx, 'put', [path[0], {
            [path[1]]: [
              {'@': new Date().getTime(), '=': value},
            ]
          }] )
        }
        console.log('path',path);
        console.log('current',current);
        console.log('incomingData',incomingData);
      }
    })();

    console.log('PROCESS:', msg);
  });

  // TODO: add .once/.on for data listening
  // TODO: add regular incoming data

  // Be somewhat compatible with gunjs
  Tank.chain = Tank.prototype;

  // Return what we've built
  return Tank;
});
