/**
 *   KEY  TYPE            CONTENT       DESCRIPTION
 *   @    {int}           timestamp     timestamp of when the data in this message was written
 *   ?    {int}           timestamp     timestamp of when this message was transmitted
 *   #    {array|string}  path          path of the subject of this message
 *   >    {array|string}  reference     redirect to a different key
 *   <    {array|string}  request       request for the current data at this path
 *   =    {object|mixed}  value         value of the path in this message
 *   _    {string}        path          local storage adapter response to a request
 *   ><   {object}        obj_response  object response to a request
 *   <>   {array|string}  path          if you're listening to #, listen to the following path as well
 */

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
        if ( null === subject ) return 'null';
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

  // Fetch the current version from a list
  function current( versions ) {
    if (!Array.isArray(versions)) return undefined;
    let result = undefined;
    versions.forEach(function (version) {
      if (!version) return;
      if (version['@'] > new Date().getTime()) return;
      if (!result) return result = version;
      if (version['@'] > result['@']) return result = version;
    });
    return result;
  }

  // https://stackoverflow.com/a/18729931
  function stringToArray( str ) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                      0x80 | ((charcode>>6) & 0x3f),
                      0x80 | (charcode & 0x3f));
        }
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18),
                      0x80 | ((charcode>>12) & 0x3f),
                      0x80 | ((charcode>>6) & 0x3f),
                      0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
  }

  // Hash a message
  // Loosely based on djb2 (we don't need cryptographic strength)
  function H( subject ) {
    if (Buffer.isBuffer(subject)) subject = [].slice.call(subject);
    if ('string' === typeof subject) subject = stringToArray(subject);
    if (!Array.isArray(subject)) return false;
    let ctx = [ 0,0,0,0,0,0,0,0 ];
    for ( let i=0; i<subject.length; i++ ) {
      ctx[i%8] = (ctx[i%8]*5)+subject[i];
      if ( ctx[i%8] >= 256 ) {
        ctx[(i+1)%8] += Math.floor(ctx[i%8]/256);
        ctx[i%8] %= 256;
      }
    }
    let out = '';
    while(ctx.length) out += ('00'+ctx.shift().toString(16)).substr(-2);
    return out;
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
      sep  : this._.sep  || '/',
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
        '#': key['#'].split(this._.sep),
        '_': Object.assign({},this._),
      });
    }
    if ('string' === typeof key && ~key.indexOf(this._.sep)) {
      key = key.split(this._.sep);
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
      case 'string':
      case 'number':
        this.in({ '@': new Date().getTime(), '#': this['#'], '=': data });
        return this;
    }

    // Publish everything with the whole path
    // Act as if data is incoming, simplifying local persistent storage
    let tank = this;
    (function recurse( path, data ) {

      // TODO: handle object reference
      Object.keys(data).forEach(function( key ) {
        let fullpath = path.concat(key);
        switch(type(data[key])) {
          case 'array':
          case 'object':
            tank.in({ '@': new Date().getTime(), '#': fullpath, '>': fullpath });
            recurse( fullpath, data[key] );
            break;
          case 'string':
          case 'number':
          case 'null':
          case 'boolean':
            tank.in({ '@': new Date().getTime(), '#': fullpath, '=': data[key] });
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
        cb.call(ctx,msg['='],ctx['#'].slice().pop());
      } else if (msg['><']) {
        let obj = Object.assign({},msg['><']);
        Object.keys(obj).forEach(function(prop) {
          obj[prop] = current(obj[prop]);
          obj[prop] = obj[prop]['>'] ? {'#':obj[prop]['?']} : obj[prop]['='];
        });
        cb.call(ctx,obj,ctx['#'].slice().pop());
      }
    }
    appListeners.once.push({
      path : ctx['#'],
      fn   : receive
    });
    localListeners[ctx['#'].join(ctx._.sep)] = localListeners[ctx['#'].join(ctx._.sep)] || [];
    localListeners[ctx['#'].join(ctx._.sep)].push(receive);
    ctx.in({ '<': ctx['#'].join(ctx._.sep) });
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
    let obj             = {},
        timeTracking    = {},
        previousVersion = undefined,
        knownPaths      = [ ctx['#'].join(ctx._.sep) ];
    function receive(msg) {
      msg = Object.assign({},msg);
      if (Array.isArray(msg['#'])) msg['#'] = msg['#'].join(ctx._.sep);
      if (msg['<>']) {
        if (~knownPaths.indexOf(msg['<>'])) return;
        knownPaths.push(msg['<>']);
        appListeners.on.push({ path: msg['<>'], fn: receive });
        if (!localListeners[msg['<>']]) localListeners[msg['<>']] = [];
        localListeners[msg['<>']].push(receive);
        ctx.in({ '<': msg['<>'] });
        return;
      }
      if (msg._) {
        localListeners[msg._].push(receive);
        if (msg['='] === undefined) return;
        msg = {'><': JSON.parse(msg['='])};
      }
      if ('=' in msg) {
        obj          = {};
        timeTracking = {};
        cb.call(ctx, msg['='], ctx['#'].slice().pop());
      } else if (msg['><']) {
        let updated = false;
        Object.keys(msg['><']).forEach(function(prop) {
          if (!(prop in timeTracking)) timeTracking[prop] = 0;
          let version = current(msg['><'][prop]);
          if (version['@'] <= timeTracking[prop]) return;
          timeTracking[prop] = version['@'];
          updated            = true;
          obj[prop] = version['>'] ? {'#':version['>']} : version['='];
        });
        let stringified = JSON.stringify(obj);
        if ( stringified === previousVersion) return;
        previousVersion = stringified;
        if (updated) cb.call(ctx,obj,ctx['#'].slice().pop());
      }
    }
    appListeners.on.push({
      path: ctx['#'],
      fn  : receive
    });
    localListeners[ctx['#'].join(ctx._.sep)] = localListeners[ctx['#'].join(ctx._.sep)] || [];
    localListeners[ctx['#'].join(ctx._.sep)].push(receive);
    ctx.in({ '<': ctx['#'].join(ctx._.sep) });
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
        let known = {};
        ctx[fetch](function(data) {
          data = filter(data);
          if ('undefined' === typeof data) return;
          let keys = Object.keys(data);
          keys.forEach(function(key) {
            if (known[key]) return;
            known[key] = true;
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

  // ENSURE MSG TIMESTAMP
  Tank.on('in', function(next, msg) {
    msg['?'] = msg['?'] || new Date().getTime();
    next(msg);
  });

  // Network deduplication
  // Blocks already-seen messages
  // TODO: verify signatures etc
  let txdedup = [];
  Tank.on('in', function( next, msg ) {
    let m    = JSON.stringify(msg);
    let hash = H(m);
    if (msg['_']) return next(msg);
    if (~txdedup.indexOf(hash)) return;
    txdedup.push(hash);
    if (txdedup.length > 8192) txdedup.shift();
    next(msg);
  });

  // Retransmission
  // TODO: make this smarter (detect non-update msg)
  Tank.on('in', function(next, msg) {
    if (!msg._) this.out(msg);
    next(msg);
  });

  // FIRST OUT
  // Encode outgoing data
  Tank.on('out', function(next, msg) {
    if ('object' === typeof msg) {
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
        ctx    = this,
        msgKey = 'string' === typeof msg['#'] ? msg['#'] : msg['#'].join(ctx._.sep);
    while(appListeners.once.length) {
      let listener = appListeners.once.shift();
      if (Array.isArray(listener.path)) listener.path = listener.path.join(ctx._.sep);
      if ( listener.path !== msgKey ) { retry.push(listener); continue; }
      listener.fn(msg);
    }
    while(retry.length) appListeners.once.push(retry.shift());

    // Handle .on
    appListeners.on.forEach(function(listener) {
      if (Array.isArray(listener.path)) listener.path = listener.path.join(ctx._.sep);
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
    let path = msg['<'].split(ctx._.sep);
    (function next(incomingData) {
      if (!path.length) return;
      let version;

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
          if (!incomingData['='][path[0].split(ctx._.sep).pop()]) return;
          version = incomingData['='][path[0].split(ctx._.sep).pop()].filter(function(version) {
            return version['@'] <= (new Date().getTime());
          }).pop();
        }

        // Follow refs
        // TODO: this is probably broken
        if (version && version['>']) {
          localListeners[version['>']] = localListeners[version['>']] || [];
          localListeners[version['>']].push(next);
          path[0] = version['>'];
          return trigger( ctx, 'get', [path[0]]);
        }
      }

      // Iterate down if required
      if (path.length>2) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(next);
        let fetchkey = path[0];
        let newkey   = path.shift() + ctx._.sep + path.shift();
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
        version = incomingData['='][path[1]].filter(function(version) {
          return version['@'] <= (new Date().getTime());
        }).pop();

        // If it's a ref, follow it
        // Rebroadcast the path change
        if (version['>']) {
          localListeners[version['>']] = localListeners[version['>']] || [];
          localListeners[version['>']].push(next);
          path = [version['>']];
          version['?'] = new Date().getTime();
          return trigger( ctx, 'get', [version['>']]);
        }

        // Re-publish that data (at our input, it could be a self-request)
        version['#'] = msg['<'];
        ctx.in(version);
        return;
      }

      // We're fetching an object, not a property
      if (!incomingData['=']) return;
      Object.keys(incomingData['=']).forEach(function(key) {
        incomingData['='][key] = [current(incomingData['='][key])];
      });
      ctx.in({ '#': msg['<'], '><': incomingData['='] });
      let msgPath  = msg['<'],
          dataPath = incomingData['_'];
      if (Array.isArray(msgPath))  msgPath  = msgPath.join(ctx._.sep);
      if (Array.isArray(dataPath)) dataPath = dataPath.join(ctx._.sep);
      if (msgPath === dataPath) return;
      ctx.in({ '#': msg['<'], '<>': dataPath });
    })();
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
      path = path.split(ctx._.sep);
    }
    function write(incomingData) {

      // Sanity check
      if (parseInt(msg['@']) > new Date().getTime()) return unwrite();
      if (!path.length) return unwrite();
      let version;

      // Handle incoming data & act accordingly
      if (incomingData) {
        incomingData = Object.assign({}, incomingData);

        // Refs
        if ( path[0] !== incomingData._ ) {
          let lastKey = path[0].split(ctx._.sep).pop();

          // Missing = start building
          if (!incomingData['=']) {
            incomingData['='] = {};
          } else {
            // Decode
            if (incomingData['='] === 'null') incomingData['='] = '{}';
            incomingData['='] = JSON.parse(incomingData['=']);
          }

          // Missing key = write
          if (!incomingData['='][lastKey]) {
            incomingData['='][lastKey] = [];
            incomingData['='][lastKey].push({'@': new Date().getTime(), '>': path[0]});
            trigger( ctx, 'put', [incomingData._,JSON.stringify(incomingData['='])] );
            ctx.in({ '<': incomingData._ });
          }

          // nullified data = write
          version = current(incomingData['='][lastKey]);
          if (!version['>']) {
            incomingData['='][lastKey].push({'@': new Date().getTime(), '>': path[0]});
            trigger( ctx, 'put', [incomingData._,JSON.stringify(incomingData['='])] );
            ctx.in({ '<': incomingData._ });
          }

          // Fetch the latest non-future version
          version = current(incomingData['='][lastKey]);

        } else {

          // Decode the incoming data
          if (!incomingData['=']) incomingData['='] = '{}';
          incomingData['='] = JSON.parse(incomingData['=']);
        }

        // Fowllow any ref
        if (version && version['>']) {
          localListeners[path[0]] = localListeners[path[0]] || [];
          localListeners[path[0]].push(write);
          path[0] = version['>'];
          return trigger( ctx, 'get', [path[0]], function() {
            this.in({ _: path[0], '=': undefined });
          });
        }
      }

      // Ensure we have data
      if (!incomingData) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(write);
        return trigger( ctx, 'get', [path[0]], function() {
          this.in({ _: path[0], '=': undefined });
        });
      } else {
        incomingData = Object.assign({},incomingData);
      }

      // Iterate down if required
      if (path.length>2) {
        localListeners[path[0]] = localListeners[path[0]] || [];
        localListeners[path[0]].push(write);
        let fetchkey = path[0];
        let newkey   = path.shift() + ctx._.sep + path.shift();
        path.unshift(newkey);
        return trigger( ctx, 'get', [fetchkey], function() {
          this.in({ _: fetchkey, '=': undefined });
        });
      }

      // Write direct value
      if (path.length === 2) {

        // Detect what we're writing
        let type = '=' in msg ? '=' : '>';
        if (type === '>' && Array.isArray(msg[type])) {
          msg[type] = msg[type].join(ctx._.sep);
        }

        // Merge or direct write
        // TODO: remove old version in merge
        if ( '?' in incomingData ) delete incomingData['?'];
        if ( '=' in incomingData ) {
          merge(incomingData['='], { [path[1]]: [{ '@': msg['@'], [type]: msg[type] }] });
          incomingData['='][path[1]] = [current(incomingData['='][path[1]])];
          trigger( ctx, 'put', [path[0], JSON.stringify(incomingData['='])] );
          ctx.in({ '<': path[0] });
        } else {
          trigger( ctx, 'put', [path[0], JSON.stringify({ [path[1]]: [{ '@': msg['@'], [type]: msg[type] }] })]);
          ctx.in({ '<': path[0] });
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
