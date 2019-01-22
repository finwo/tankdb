const Tank = require('../tank');
require('../lib/adapter/websocket');

const db = Tank({
  node : 'CLIENT',
  peers: ['ws://localhost:10666'],
});

// Fetch a reference to what we're about to write
let adminRef = db.get('account').get('admin');

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

  setTimeout(function() {
    console.log('client signing off...');
  }, 1000);
}, 5000);
