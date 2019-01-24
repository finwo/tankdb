# Tank DB

Distributed graph database

[![NPM](https://nodei.co/npm/tankdb.png)](https://nodei.co/npm/tankdb/)

---

## Why? <a id="why" href="#why">#</a>

All graph (or graph-like) databases I tested are not yet production-ready. This library was written as a common subset
of these tested libraries, allowing me to upgrade into one of those once they are deemed stable.

## Setup <a id="setup" href="#setup">#</a>

After install TANK with NPM (`npm install --save tankdb`), add the following to your server code to load the library:

```js
const Tank = require('tankdb');
```

Once you've loaded the libraries, you'll have to decide how you want the storage to be handled.
By default, no adapters for storage and networking are loaded. You'll have to load these as described in [the adapters section](#adapters).

To initialize your TANK, the following code should be used:

```js
let db = Tank(opts);
```

Tank doesn't care whether you use `Tank` or `new Tank`. It simply handles both cases. Options to pass are described later in this readme.

## API <a id="api" href="#api">#</a>

- Core API
  - [Constructor](#api.constructor)
  - [tank.get](#api.tank.get)
  - [tank.put](#api.tank.put)
- Main API
  - [tank.on](#api.tank.on)
  - [tank.once](#api.tank.once)
  - [tank.map](#api.tank.map)

### Constructor <a id="api.constructor" href="#api.constructor">#</a>

Used to create a new TANK database instance

```js
let db = Tank(opts);
```

### tank.get <a id="api.tank.get" href="#api.tank.get">#</a>

Follows a path, directing where to act. This function **DOES NOT** actually fetch data, it only follows a path.

```js
db.get( key );
```

### tank.put <a id="api.tank.put" href="#api.tank.put">#</a>

Save data into TANK, syncing it with your connected peers.

```js
db.get( key ).put({ hello: 'world' });
```

You do not need to re-save the entire object every time, TANK will automatically merge your data into what already exists
as a "partial" update.

TODO: describe supported data types

### tank.on <a id="api.tank.on" href="#api.tank.on">#</a>

Subscribe to updates and changes on a node or property in realtime.

```js
db.get( key ).on( callback );
```

A request is made to the network for the current path, after which responses will trigger the callback. Updates to the data
will also trigger the callback, allowing you to act whenever the data is updated.

### tank.once <a id="api.tank.once" href="#api.tank.once">#</a>

Get the current data without subscribing to updates, responds with `undefined` if the data can not be found.

```js
db.get( key ).once( callback );
```

Just like `.on`, it sends out a request for the current path. The callback will only be fired once on received data.

### tank.map <a id="api.tank.map" href="#api.tank.map">#</a>

`.map` iterates over each property and item on a node, passing it down the chain, behaving like `Array.map` on your data. It
also subscribes to every item as well and listens for newly inserted items. It accepts a callback to transform the data
before pasing it on to the next listener.

```js
let users = db.get('users');
users.map( callback );
```

Summary of behaviors:

- `users.map().on(cb)` subscribes to changes on every user and to users as they are added.
- `users.map().once(cb)` gets each user once, including ones that are added over time.
- `users.once().map().on(cb)` gets the user list once, but subscribes to changes on each of those users (not added ones).
- `users.once().map().once()` gets the user list once, gets each of those users only once (not added ones).

## Adapters <a id="adapters" href="#adapters">#</a>

### LevelDB <a id="adapters.leveldb" href="#adapters.leveldb">#</a>

LevelDB is the recommended storage layer for TANK. To enable LevelDB support, add the following line after loading the tank library but
BEFORE instantiating the database.

```js
require('tankdb/lib/adapter/level');
```

This adapter is not restricted to leveldb though. Any storage engine with compatible `get` and `put` methods should be supported.
To pass a leveldb instance to your Tank instance, pass the initialized instance into `opts.level`.

### WebSocket <a id="adapters.websocket" href="#adapters.websocket">#</a>

Using WebSockets is the only method of networking supported so far. To make TANK start using them, add the following line after loading
the library but BEFORE instantiating the database.

```js
require('tankdb/lib/adapter/websocket');
```

Custom websocket libraries are supported (well, libraries honering it's API). To use a custom library, pass it into `opts.WebSocket`.
Peers to connect to can be passed into `opt.peers`, allowing you to set up a server..

## Supporting TankDB

Supporting this project can be done in multiple ways, as listed below.

- [Open an issue](https://gitlab.com/finwo/tank/issues/new) about a bug you found or to request a new feature
- [Open a merge request](https://gitlab.com/finwo/tank/merge_requests/new) to fix a bug you found or to implement a new feature
- [Contribute on patreon](https://patreon.com/finwo)
