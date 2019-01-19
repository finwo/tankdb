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
    this._ = {
      path : this._.path || [],
      root : this._.root || this,
      opts : this._.opts || opts,
    };

    // Trigger opt on fresh instance
    if (fresh) trigger( this, 'opt' );
  }

  // Following a path
  Yenta.prototype.get = function( key ) {
    if ('string' !== typeof key) return this;
    if (!key) return this;
    return Tank.call({_:Object.assign({},this._,{
      path: this.path.concat(key),
    })});
  }

  // Lists of hooks
  let hooks = {};

  // Trigger a hook
  function trigger( ctx, name, data ) {
    if (!(name in hooks)) return;
    let queue = hooks[name].slice();
    (function next(data) {
      let fn = queue.shift();
      if (!fn) return;
      fn.call( ctx, data, next );
    })(data);
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
  }

  // Be somewhat compatible with gunjs
  Tank.chain = Tank.prototype;

  // Return what we've built
  return Tank;
});
