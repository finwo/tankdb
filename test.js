// Load the lib
let Tank = require('./tank');

// Attach listeners to verify IO
Tank.on('in', function(next, msg) {
  console.log('IN', this, msg);
});
Tank.on('out', function(next, msg) {
  console.log('OUT', this, msg);
});

// Create a database
let tank = Tank();

// Fetch a reference to what we're about to write
let adminRef = tank.get('account').get('admin');

// Write data
adminRef.put({
  username: 'admin',
});

console.log(tank);
console.log(adminRef);

setTimeout(console.log,1000);
