# Tank DB

Distributed graph database

[![NPM](https://nodei.co/npm/tankdb.png)](https://nodei.co/npm/tankdb/)

---

## WHy?

All graph (or graph-like) databases I tested are not yet production-ready. This library was written as a common subset
of these tested libraries, allowing me to upgrade into one of those once they are deemed stable.

## API

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

## Adapters

### LevelDB

LevelDB is the recommended storage layer for TANK. To enable LevelDB support, add the following line after loading the tank library but
BEFORE instantiating the database.

```js
require('tankdb/lib/adapter/level');
```

This adapter is not restricted to leveldb though. Any storage engine with compatible `get` and `put` methods should be supported.
To pass a leveldb instance to your Tank instance, pass the initialized instance into `opts.level`.

### WebSocket

Using WebSockets is the only method of networking supported so far. To make TANK start using them, add the following line after loading
the library but BEFORE instantiating the database.

```js
require('tankdb/lib/adapter/websocket');
```

Custom websocket libraries are supported (well, libraries honering it's API). To use a custom library, pass it into `opts.WebSocket`.
Peers to connect to can be passed into `opt.peers`, allowing you to set up a server..
