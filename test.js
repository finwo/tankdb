let autolevel = require('autolevel'),
    level     = autolevel('dir://data/');

// Load the lib + leveldb adapter
let Tank = require('./tank');
require('./lib/adapter/level');

// // IO logging
// Tank.on('get', function(next, key) {
//   console.log('GET', key);
//   next(key);
// });
// Tank.on('put', function(next, key, value) {
//   console.log('PUT', key, value);
//   next(key, value);
// });
// Tank.on('in', function(next, msg) {
//   console.log('IN', msg);
//   next(msg);
// });
// Tank.on('out', function(next, msg) {
//   console.log('OUT', msg);
//   next(msg);
// });

// Create a database
let tank = Tank({ level });

// Fetch a reference to what we're about to write
let adminRef = tank.get('account').get('admin');

// Write data
adminRef.put({
  username: 'admin',
  fullname: 'Marco Polo',
  options : {
    awesome: true,
    powerful: 'yes'
  }
});

console.log('waiting...');
setTimeout(function() {
  console.log('Fetching...');
  adminRef.once(function(admin) {
    console.log('ADMIN', admin);
    this.get('options').once(function(adminOptions) {
      console.log('OPTIONS',adminOptions);
    })
  });
}, 200);

// // Check if we can use .once
// let loop = 10;
// while(loop--) {
// }

// Let data flow
// setTimeout(function(){}, 5000);
