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
  let universe = new Function('return this').call(),
      noop     = function(){};

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
    let opts  = Object.assign({ws:false},options),
        fresh = !('_' in this);

    // Build the path
    this['#'] = this['#'] || [];

    // Ensure a fully-built context
    this._ = this._ || {};
    this._ = {
      root : this._.root || this,
      opts : this._.opts || opts,
      once : this._.once || false, // Fetch from once + path, not only path
      map  : this._.map  || false, // Fetch from map  + path, not only path
    };

    // Trigger opt on fresh instance
    if (fresh) trigger( this, 'create' );
    return this;
  }

  // Prevent circular json
  Tank.prototype.toJSON = function() {
    return {'#':this['#']};
  };

  // Easy in trigger
  Tank.prototype.in = function() {
    trigger( this._.root, 'in', arguments);
    return this;
  };

  // Easy out trigger
  Tank.prototype.out = function() {
    trigger( this._.root, 'out', arguments );
    return this;
  };

  // Following a path
  Tank.prototype.get = function( key ) {
    if (('object' === typeof key) && key['#']) {
      return Tank.call({
        '#': key['#'].split('/'),
        '_': Object.assign({},this._),
      });
    }
    if (Array.isArray(key)) {
      let result = this;
      let path   = key.slice();
      while(path.length) result = result.get(path.shift());
      return result;
    }
    if ('number' === typeof key) key = key.toString();
    if ('string' !== typeof key) return this;
    if (!key) return this;
    return Tank.call({
      '#': this['#'].concat(key),
      '_': Object.assign({},this._),
    });
  };

  // Writing data
  Tank.prototype.put = function( data ) {

    // Non-object data is not supported at the root
    if (this['#'].length <= 1) {
      if ( 'object' !== typeof data ) throw new Error('Non-object data can not be saved at the root');
      if ( !data ) throw new Error('Non-object data can not be saved at the root');
    }

    // Direct null write
    switch(type(data)) {
      case 'object':
        if (data['#']) {
          this.in({ '@': new Date().getTime(), '#': this['#'], '>': data['#'] });
          return this;
        }
        break;
      case 'null':
        this.in({ '@': new Date().getTime(), '#': this['#'], '=': null });
        return this;
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
            if (!data[key]) return tank.in({ '@': now, '#': fullpath, '=': null });
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
    })( this['#'], data );
    return this;
  };

  // Fetch a data, non-live
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
    if ( this._.map  ) { this._.map('once', cb); return this; }

    // Normal behavior
    // Emit request & listen for it
    let found = false;
    function receive(msg) {
      if (found) return;
      msg   = Object.assign({},msg);
      if (msg._ && !msg['=']) {
        localListeners[msg._].push(receive);
        return;
      }
      if (msg._) {
        msg = {'><' : JSON.parse(msg['='])};
      }
      found = true;
      if ('=' in msg) {
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
    appListeners.once.push({
      path : ctx['#'],
      fn   : receive
    });
    localListeners[ctx['#'].join('/')] = localListeners[ctx['#'].join('/')] || [];
    localListeners[ctx['#'].join('/')].push(receive);
    ctx.in({ '<': ctx['#'].join('/') });
    setTimeout(function() {
      if (found) return;
      found = true;
      cb.call(ctx,undefined,ctx['#']);
    }, this._.opts.wait || 2000);
    return this;
  };

  // Fetch data, LIVE QUERY
  Tank.prototype.on = function( cb ) {
    let ctx = this;

    // .map().on()
    if ( this._.map ) { this._.map('on', cb); return this; }

    // Normal behavior
    // Emit request & keep listening
    let previousVersion = undefined;
    function receive(msg) {
      msg = Object.assign({},msg);
      if (msg._) {
        localListeners[ctx['#'].join('/')].push(receive);
        if (msg['='] === undefined) return;
        msg = {'><': JSON.parse(msg['='])};
      }
      if ('=' in msg) {
        cb.call(ctx, msg['='], msg['#']);
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
        if (previousVersion === JSON.stringify(obj)) return;
        previousVersion = JSON.stringify(obj);
        cb.call(ctx,obj,msg['#']);
      }
    }
    appListeners.on.push({
      path: ctx['#'],
      fn  : receive
    });
    localListeners[ctx['#'].join('/')] = localListeners[ctx['#'].join('/')] || [];
    localListeners[ctx['#'].join('/')].push(receive);
    ctx.in({ '<': ctx['#'].join('/') });
    return this;
  };

  // Mapping data!!!
  Tank.prototype.map = function( filter ) {
    let fetch = this._.once ? 'once' : 'on';
    let ctx   = this;

    if ('function' !== typeof filter) {
      filter = function( entity ) { return entity; };
    }

    return Tank.call({_:Object.assign({},this._,{
      once : false,
      map  : function( mode, receiver ) {
        if (!receiver) return;
        if (!~['on','once'].indexOf(mode)) return;
        let knownKeys = [];
        ctx[fetch](function(data) {
          data = filter(data);
          if ('undefined' === typeof data) return;
          let keys = Object.keys(data);
          keys.forEach(function(key) {
            if (~knownKeys.indexOf(key)) return;
            knownKeys.push(key);
            ctx.get(key)[mode](receiver);
          });
        });
      },
    })});
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

  // Emit local data on put
  Tank.on('put', function( next, key, value ) {
    this.in({ '_': key, '=': value });
    next(key, value);
  });

  // FIRST IN
  // Decode incoming data from buffer/array/string
  Tank.on('in', function(next, msg) {
    try {
      if ('object' === typeof Buffer && Buffer.isBuffer(msg)) return next(JSON.parse(msg));
      if (Array.isArray(msg)) msg = msg.map(function(c) { return String.fromCharCode(c); }).join('');
      if ('string' === typeof msg) msg = JSON.parse(msg);
    } catch(e) {}
    next(msg);
  });

  // FIRST OUT
  // Encode outgoing data
  Tank.on('out', function(next, msg) {
    if ('object' === typeof msg) {
      msg['?'] = msg['?'] || new Date().getTime()
      msg = JSON.stringify(msg);
    }
    next(msg);
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
    if ('object' !== typeof msg) return;
    if (!msg['#']) return;

    // Handle .once
    let retry  = [],
        msgKey = 'string' === typeof msg['#'] ? msg['#'] : msg['#'].join('/');
    while(appListeners.once.length) {
      let listener = appListeners.once.shift();
      if (Array.isArray(listener.path)) listener.path = listener.path.join('/');
      if ( listener.path !== msgKey ) { retry.push(listener); continue; }
      listener.fn(msg);
    }
    while(retry.length) appListeners.once.push(retry.shift());

    // Handle .on
    appListeners.on.forEach(function(listener) {
      if (Array.isArray(listener.path)) listener.path = listener.path.join('/');
      if ( listener.path !== msgKey ) return;
      listener.fn(msg);
    });
  });

  // Respond to data requests
  Tank.on('in', function( next, msg ) {
    let ctx = this;
    next(msg);
    if ('object' !== typeof msg) return;

    // Ensure this is a request
    if (!msg['<']) return;

    // Let's follow the path
    let path = msg['<'].split('/');
    (function next(incomingData) {
      if (!path.length) return;
      let current;

      if (incomingData) {

        // Re-listen, this function should NEVER get undefined
        // Why? Parallel .once & store generates undefined incomingData['=']
        if (!incomingData['=']) {
          localListeners[incomingData._] = localListeners[incomingData._] || [];
          localListeners[incomingData._].push(next);
          return trigger( ctx, 'get', [incomingData._] );
        }

        // Decode data
        incomingData = Object.assign({}, incomingData);
        incomingData['='] = JSON.parse(incomingData['=']);

        // Fetch the value
        if ( incomingData._ !== path[0] ) {
          if (!incomingData['='][path[0].split('/').pop()]) return;
          current = incomingData['='][path[0].split('/').pop()].filter(function(version) {
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
        let newkey   = path.shift() + '/' + path.shift();
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
      ctx.in({ '#': msg['<'], '><': incomingData['='] });
    })();
  });

  // Network deduplication
  // Blocks already-seen messages
  // TODO: verify signatures etc
  let txdedup = [], dedupto;
  Tank.on('in', function( next, msg ) {
    let stringified = JSON.stringify(msg);
    if (~txdedup.indexOf(stringified)) return;
    next(msg);
    this.out(msg);
  });
  Tank.on('out', function( next, msg ) {
    txdedup.push(msg);
    if (!dedupto) dedupto = setTimeout(function() {
      while(txdedup.length > 16) txdedup.shift();
      dedupto = false;
    }, 200);
    if ( txdedup.length > 2 && msg === txdedup[txdedup.length-2] ) return;
    next(msg);
  });

  // Store incoming data
  // TODO: use data request (.once) instead of local only?
  Tank.on('in', function( next, msg ) {
    next(msg);
    if ('object' !== typeof msg) return;
    let ctx  = this,
        root = this._.root;

    // Check if this msg needs processing
    if (!msg['@']) return;
    if (!msg['#']) return;
    if (!('=' in msg || '>' in msg)) return;

    function unwrite() {
      if (!root._.writeQueue) return;
      if (!root._.writeQueue.length) {
        delete root._.writeQueue;
        return;
      }
      (root._.writeQueue.shift()||unwrite)();
    }

    // TODO: follow the path (maybe generate a fresh queue)
    let path = msg['#'];
    if (Array.isArray(path)) {
      path = path.slice();
    } else {
      path = path.split('/');
    }
    function write(incomingData) {

      // Sanity check
      if (!path.length) return unwrite();
      let current;

      // Handle incoming data & act accordingly
      if (incomingData) {
        incomingData = Object.assign({}, incomingData);

        // Refs
        if ( path[0] !== incomingData._ ) {
          // Missing = write it
          if (!incomingData['=']) {
            incomingData['='] = {
              [path[0].split('/').pop()]: [{ '@': new Date().getTime(), '>': path[0] }]
            };
            trigger( ctx, 'put', [ incomingData._, JSON.stringify(incomingData['=']) ] );
          } else {

            // We know it's supposed to be an object
            if ('null' === incomingData['=']) {
              incomingData['='] = '{}';
            }

            // Decode the incoming data
            incomingData['='] = JSON.parse(incomingData['=']);
          }

          // Ensure our key exists
          if (!incomingData['='][path[0].split('/').pop()]) {
            incomingData['='][path[0].split('/').pop()] = [{ '@': new Date().getTime(), '>': path[0] }];
            trigger( ctx, 'put', [ incomingData._, JSON.stringify(incomingData['=']) ] );
            ctx.out({ '<': incomingData._ });
          }

          // Fetch the latest non-future version
          current = incomingData['='][path[0].split('/').pop()].filter(function(version) {
            return version['@'] <= (new Date().getTime());
          }).pop();

        } else {

          // Missing = someone else is working on it
          if (!incomingData['=']) {
            incomingData['='] = '{}';
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
        let newkey   = path.shift() + '/' + path.shift();
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
        let type = '=' in msg ? '=' : '>';
        if (type === '>' && Array.isArray(msg[type])) {
          msg[type] = msg[type].join('/');
        }
        if ( '=' in incomingData ) {
          merge(incomingData['='], { [path[1]]: [{ '@': msg['@'], [type]: msg[type] }] });
          trigger( ctx, 'put', [path[0], JSON.stringify(incomingData['='])] );
        } else {
          trigger( ctx, 'put', [path[0], JSON.stringify({ [path[1]]: [{ '@': msg['@'], [type]: msg[type] }] })]);
        }

        // Free the lock
        return unwrite();
      }

    }

    // Write once we're ready
    if (root._.writeQueue) return root._.writeQueue.push(write);
    root._.writeQueue = [write];
    unwrite();
  });

  // Sending data to supported peers
  Tank.on('out', function(next, msg) {
    let ctx   = this._.root,
        peers = this._.root._.opts.peers;
    if (!peers) return;
    peers.forEach(function(peer) {
      if ('object' !== typeof peer) return;
      if (!peer) return;
      if ('function' !== typeof peer.send) return;
      peer.send(msg);
    });
    next(msg);
  });

  // Be somewhat compatible with gunjs
  Tank.chain = Tank.prototype;

  // Return what we've built
  return Tank;
});
