let autolevel = require('autolevel'),
    level     = autolevel('dir://data/');

// Load the lib + leveldb adapter
let Tank = require('./tank');
require('./lib/adapter/level');

// IO logging
Tank.on('get', function(next, key) {
  console.log('GET', key);
  next(key);
});
Tank.on('put', function(next, key, value) {
  console.log('PUT', key, value);
  next(key, value);
});

// Create a database
let tank = Tank({ level });

// Fetch a reference to what we're about to write
let adminRef = tank.get('account').get('admin');

// Write data
adminRef.put({
  username: 'admin',
});

// console.log('Waiting 1 second');
setTimeout(function() {
  adminRef.put({
    username: 'root',
    fullname: 'Marco Polo',
  });
  // console.log('Waiting 1 second');
setTimeout(function() {
    level.get('account', console.log.bind(console,'account') );
    level.get('account.admin', console.log.bind(console,'account.admin') );
  }, 1000);
},1000);
