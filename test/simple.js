let autolevel = require('autolevel'),
    level     = autolevel('dir://data/');

// Load the lib + leveldb adapter
let Tank = require('../tank');
require('../lib/adapter/level');

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
  },
  contact: [
    { type: 'email', value: 'marco@trackthis.nl' },
    { type: 'website', value: 'trackthis.nl' },
  ]
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
