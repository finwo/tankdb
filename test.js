// Simple in-memory kv
let kv = {
  _: {},
  get: function( key ) {
    return kv._[key];
  },
  put: function( key, value ) {
    return kv._[key] = value;
  },
}

// Load the lib
let Tank = require('./tank');

// Attach listeners to verify IO
Tank.on('in', function(next, msg) {
  console.log('IN', this, msg);
});
Tank.on('out', function(next, msg) {
  console.log('OUT', this, msg);
});

// KV adapter
Tank.on('get', function(next, key) {
  let tank = this;
  next(key);
  console.log(this);
  setTimeout(function() {
    tank.in({ '_': key, '=': kv.get(key) });
  }, 1);
});
Tank.on('put', function(next, key, value) {
  console.log('PUT', key, typeof value, value);
  kv.put(key, value);
  next(key);
});

// Create a database
let tank = Tank();

// Fetch a reference to what we're about to write
let adminRef = tank.get('account').get('admin');

// Write data
adminRef.put({
  username: 'admin',
});

setTimeout(function() {
  console.log('DATA', kv._['account.admin']);
  adminRef.put({
    username: 'root',
    fullname: 'Marco Polo',
  });
  setTimeout(function() {
    console.log('DATA', kv._);
  }, 1000);
},1000);
