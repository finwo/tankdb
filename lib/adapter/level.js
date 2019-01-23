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

  let registered = false;
  Tank.on('opt', function(next) {

    // Run only once & run others
    next();
    if (registered) return;
    registered = true;

    // Fetching data
    Tank.on('get', function(next, key) {
      let tank = this, level = tank._.opts.level;
      if (!level) return next(key);
      level.get(key, function(err, value) {
        if (err) return next(key);
        tank.in({ _: key, '=': value.toString() });
      });
    });

    // Writing data
    Tank.on('put', function(next, key, value, cb) {
      next(key,value);
      let tank = this, level = tank._.opts.level;
      if (!level) return;
      level.put(key,value,function(err) {
        if (err) console.error(err);
        if (cb) cb(err);
      });
    });

  });
});
