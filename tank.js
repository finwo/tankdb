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

  // Detect the type of a variable
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

  // Merge 2 objects
  function merge( target, source ) {
    if ('object' !== typeof target) return;
    if ('object' !== typeof source) return;
    if (!(target&&source)) return;
    Object.keys(source).forEach(function(key) {
      let ltype = type(target[key]),
          rtype = type(source[key]);
      if ( ltype !== rtype ) {
        target[key] = source[key];
        return;
      }
      if (ltype === 'array') {
        target[key] = target[key].concat(source[key]);
        return;
      }
      if (ltype === 'object') {
        merge(target[key], source[key]);
        return;
      }
      target[key] = source[key];
    });
    return target;
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
      once : this._.once || false, // Fetch from once + path, not only path
      map  : this._.map  || false, // Fetch from map  + path, not only path
    };

    // Trigger opt on fresh instance
    if (fresh) trigger( this, 'create' );
    return this;
  }

  // Easy in trigger
  Tank.prototype.in = function() {
    trigger( this._.root, 'in', arguments);
    return this;
  };

  // Easy out trigger
  Tank.prototype.out = function() {
    trigger( this._.root, 'out', arguments );
    return this;
  }

  // Following a path
  Tank.prototype.get = function( key ) {
    if (Array.isArray(key)) {
      let result = this;
      let path   = key.slice();
      while(path.length) result = result.get(path.shift());
      return result;
    }
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
          case 'boolean':
            tank.in({ '@': now, '#': fullpath, '=': data[key] });
            break;
        }
      });
    })( this._.path, data );
    return this;
  };

  // Start fetching data
  Tank.prototype.once = function( cb ) {
    let ctx = this;

    // .once().map()
    // Returns a new chain, tells map to call .once
    if ( 'function' !== typeof cb ) {
      return Tank.call({_:Object.assign({},this._,{
        map  : false,
        once : ctx.once
      })});
    }

    // .map().once()
    // Passes the callback down to the map, let map handle it
    if ( this._.map  ) { this._.map({ once: cb }); return this; }

    // Normal behavior
    // Emit request & listen for it
    let found = false;
    appListeners.once.push({
      path : ctx._.path,
      fn   : function(msg) {
        if (found) return;
        msg   = Object.assign({},msg);
        found = true;
        if (msg['=']) {
          cb.call(ctx,msg['='],msg['#']);
        } else if (msg['><']) {
          let obj = Object.assign({},msg['><']);
          Object.keys(obj).forEach(function(prop) {
            obj[prop] = obj[prop].filter(function(version) {
              return version['@'] <= new Date().getTime();
            }).sort(function( a, b ) {
              if ( a['@'] < b['@'] ) return -1;
              if ( a['@'] > b['@'] ) return 1;
              return 0;
            }).pop();
            if (obj[prop]['>']) {
              obj[prop] = { '#': obj[prop]['>'] };
            } else {
              obj[prop] = obj[prop]['='];
            }
          });
          cb.call(ctx,obj,msg['#']);
        }
      }
    });
    ctx.in({ '<': ctx._.path });
    setTimeout(function() {
      if (found) return;
      found = true;
      cb.call(ctx,undefined,ctx._.path);
    }, 2000);
  };

  // Lists of hooks
  let hooks = {};

  // Trigger a hook
  function trigger( ctx, name, args, final ) {
    if (!(name in hooks)) return;
    final = final || function(){};
    let queue = hooks[name].slice();
    (function next() {
      let fn = queue.shift();
      if (!fn) return final.apply( ctx, arguments );
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

  // 8-slot lru cache
  Tank.on('get', function retry( next, key ) {
    let ctx = this;
    ctx._.root._.lru = ctx._.root._.lru || {data:{},keys:[]};
    let now     = new Date().getTime();
    let data    = ctx._.root._.lru.data;
    if ( key in data ) {
      ctx.in({ '_': key, '=': data[key] });
    } else {
      next(key);
    }
  });
  Tank.on('put', function( next, key, value ) {
    this._.root._.lru = this._.root._.lru || {data:{},keys:[]};
    let data = this._.root._.lru.data;
    let keys = this._.root._.lru.keys;
    data[key] = value;
    keys.push(keys);
    while( keys.length > 8 ) {
      let banish = keys.shift();
      if (~keys.indexOf(banish)) continue;
      delete data[banish];
    }
    next( key, value );
  });

  // Handle storage adapter responses
  // TODO: THIS MUST NOT BE A GLOBAL VARIABLE
  let localListeners = {};
  Tank.on('in', function( next, msg ) {
    if (!msg._) return next(msg);
    if (!(msg._ in localListeners)) return;
    let queue = localListeners[msg._];
    localListeners[msg._] = [];
    while(queue.length) {
      let fn = queue.shift();
      if (!fn) continue;
      fn(msg);
    }
  });

  // Handle app listeners
  // TODO: THIS MUST NOT BE A GLOBAL VARIABLE
  let appListeners = {on:[],once:[]};
  Tank.on('in', function(next, msg) {
    next(msg);
    if (!msg['#']) return;
    if (!(msg['=']||msg['>']||msg['><'])) return;
    let retry  = [],
        msgKey = 'string' === typeof msg['#'] ? msg['#'] : msg['#'].join('.');
    while(appListeners.once.length) {
      let listener = appListeners.once.shift();
      if (Array.isArray(listener.path)) listener.path = listener.path.join('.');
      if ( listener.path !== msgKey ) { retry.push(listener); continue; }
      listener.fn(msg);
    }
    while(retry.length) appListeners.once.push(retry.shift());
    appListeners.on.forEach(function(listener) {
      if ( listener.path.join('.') !== msg['#'].join('.') ) return;
      listener.fn(msg);
    });
  });

  // Respond to data requests
  Tank.on('in', function( next, msg ) {
    let ctx = this;
    next(msg);

    // Ensure this is a request
    if (!msg['<']) return;

    // Let's follow the path
    let path = msg['<'].slice();
    (function next(incomingData) {
      if (!path.length) return;
      let current;

      if (incomingData) {

        // Re-listen, this function should NEVER get undefined
        // Why? Parallel .once & store generates undefined incomingData['=']
        if (!incomingData['=']) {
          localListeners[incomingData['_']] = localListeners[incomingData['_']] || [];
          localListeners[incomingData['_']].push(next);
          return trigger( ctx, 'get', [incomingData['_']] );
        }

        // Decode data
        incomingData = Object.assign({}, incomingData);
        incomingData['='] = JSON.parse(incomingData['=']);

        // Fetch the value
        if ( incomingData['_'] !== path[0] ) {
          current = incomingData['='][path[0].split('.').pop()].filter(function(version) {
            return version['@'] <= (new Date().getTime());
          }).pop();
        }

        // Follow refs
        // TODO: this is probably broken
        if (current && current['>']) {
          localListeners[current['>']] = localListeners[current['>']] || [];
          localListeners[current['>']].push(next);
          path[0] = current['>'];
          return trigger( ctx, 'get', [path[0]]);
        }
      }

      // Iterate down if required
      if (path.length>2) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(next);
        let fetchkey = path[0];
        let newkey   = path.shift() + '.' + path.shift();
        path.unshift(newkey);
        return trigger( ctx, 'get', [fetchkey]);
      }

      // Ensure we have data
      if (!incomingData) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(next);
        return trigger( ctx, 'get', [path[0]]);
      }

      // It's time to fetch data
      if (path.length === 2) {
        if (!incomingData['=']) return;

        // Fetch the most recent version
        if (!incomingData['='][path[1]]) return;
        current = incomingData['='][path[1]].filter(function(version) {
          return version['@'] <= (new Date().getTime());
        }).pop();

        // If it's a ref, follow it
        if (current['>']) {
          localListeners[current['>']] = localListeners[current['>']] || [];
          localListeners[current['>']].push(next);
          path = [current['>']];
          return trigger( ctx, 'get', [current['>']]);
        }

        // Re-publish that data (at our input, it could be a self-request)
        current['#'] = msg['<'];
        ctx.in(current);
      }

      // We're fetching an object, not a property
      if (!incomingData['=']) return;
      Object.keys(incomingData['=']).forEach(function(key) {
        incomingData['='][key] = [incomingData['='][key].filter(function(version) {
          return version['@'] <= new Date().getTime();
        }).sort(function(a,b) {
          if ( a['@'] < b['@'] ) return -1;
          if ( a['@'] > b['@'] ) return 1;
          return 0;
        }).pop()];
      });
      ctx.in({ '#': incomingData['_'], '><': incomingData['='] });
    })();
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
    if (txdedup.length > 100) txdedup.shift();
    next(msg);
  });

  // Network retransmission
  Tank.on('in', function( next, msg ) {
    next(msg);
    // TODO: verify signatures etc
    this.out(msg);
  });

  // Store incoming data
  // TODO: use data request (.once) instead of local only?
  Tank.on('in', function( next, msg ) {
    let ctx  = this,
        root = this._.root;
    next(msg);

    // Check if this msg needs processing
    if (!msg['@']) return;
    if (!msg['#']) return;
    if (!(msg['=']||msg['>'])) return;

    // TODO: follow the path (maybe generate a fresh queue)
    let path  = msg['#'].slice();
    function write(incomingData) {

      // Sanity check
      if (!path.length) return root._.writing = false;
      let current;

      // Handle incoming data & act accordingly
      if (incomingData) {
        incomingData = Object.assign({}, incomingData);

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

          // Ensure our key exists
          if (!incomingData['='][path[0].split('.').pop()]) {
            incomingData['='][path[0].split('.').pop()] = [{ '@': new Date().getTime(), '>': path[0] }];
            trigger( ctx, 'put', [ incomingData['_'], JSON.stringify(incomingData['=']) ] );
          }

          // Fetch the latest non-future version
          current = incomingData['='][path[0].split('.').pop()].filter(function(version) {
            return version['@'] <= (new Date().getTime());
          }).pop();

        } else {

          // Missing = someone else is working on it
          if (!incomingData['=']) {
            incomingData['='] = 'null';
            // trigger( ctx, 'put', [incomingData['_'],incomingData['=']] );
          }

          // Decode the incoming data
          incomingData['='] = JSON.parse(incomingData['=']);
        }

        // Fowllow any ref
        if (current && current['>']) {
          localListeners[path[0]] = localListeners[path[0]] || [];
          localListeners[path[0]].push(write);
          path[0] = current['>'];
          return trigger( ctx, 'get', [path[0]], function() {
            this.in({ _: path[0], '=': undefined });
          });
        }
      }

      // Iterate down if required
      if (path.length>2) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(write);
        let fetchkey = path[0];
        let newkey   = path.shift() + '.' + path.shift();
        path.unshift(newkey);
        return trigger( ctx, 'get', [fetchkey], function() {
          this.in({ _: fetchkey, '=': undefined });
        });
      }

      // Ensure we have data
      if (!incomingData) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(write);
        return trigger( ctx, 'get', [path[0]], function() {
          this.in({ _: path[0], '=': undefined });
        });
      }

      // Write direct value
      if (path.length === 2) {

        // Detect what we're writing
        let type = msg['='] ? '=' : '>';
        if (type === '>' && Array.isArray(msg[type])) {
          msg[type] = msg[type].join('.');
        }
        if (!incomingData['=']) {
          trigger( ctx, 'put', [path[0], JSON.stringify({ [path[1]]: [{ '@': msg['@'], [type]: msg[type] }] })]);
        } else {
          merge(incomingData['='], { [path[1]]: [{ '@': msg['@'], [type]: msg[type] }] });
          trigger( ctx, 'put', [path[0], JSON.stringify(incomingData['='])] );
        }

        // Free the lock
        root._.writing = false;
      }
    }

    // Write once we're ready
    (function retry() {
      if (root._.writing) return setTimeout(retry,1);
      root._.writing = true;
      write();
    })();
  });

  // TODO: add .once/.on for data listening
  // TODO: add regular incoming data

  // Be somewhat compatible with gunjs
  Tank.chain = Tank.prototype;

  // Return what we've built
  return Tank;
});
