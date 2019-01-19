// Load the lib
let Tank = require('./tank');

// Attach listeners to verify IO
Tank.on('in', function(data, next) {
  console.log('IN', this, data);
});
Tank.on('out', function(data, next) {
  console.log('OUT', this, data);
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
