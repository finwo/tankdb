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

  // Return what we've built
  return Yenta;
});
