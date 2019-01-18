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
    window.Yenta = factory();
  } else {
    // Unknown environment
    throw new Error('Yenta is not supported in this environment');
  }

})(function() {

  // Fetch a reference to global
  let universe = new Function('return this').call();

  // Our main constructor
  function Yenta(options) {

    // Sanity checks
    if ( this === universe ) return new Yenta(options);
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
  Yenta.on = function( name, handler ) {
    if ('function' !== typeof handler ) return Yenta;
    if ('string' !== typeof name ) return Yenta;
    if (!handler) return Yenta;
    if (!name) return Yenta;
    if (!(name in hooks)) hooks[name] = [];
    hooks[name].push(handler);
    return Yenta;
  }

  // Be somewhat compatible with gunjs
  Yenta.chain = Yenta.prototype;

  // Return what we've built
  return Yenta;
});
