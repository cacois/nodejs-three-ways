(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var Log = Package.logging.Log;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var Deps = Package.deps.Deps;
var AppConfig = Package['application-configuration'].AppConfig;
var check = Package.check.check;
var Match = Package.check.Match;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;

/* Package-scope variables */
var MongoInternals, MongoTest, MongoConnection, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, ObserveHandle, DocFetcher, PollingObserveDriver, OplogObserveDriver, LocalCollectionDriver;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/mongo_driver.js                                                             //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
/**                                                                                                    // 1
 * Provide a synchronous Collection API using fibers, backed by                                        // 2
 * MongoDB.  This is only for use on the server, and mostly identical                                  // 3
 * to the client API.                                                                                  // 4
 *                                                                                                     // 5
 * NOTE: the public API methods must be run within a fiber. If you call                                // 6
 * these outside of a fiber they will explode!                                                         // 7
 */                                                                                                    // 8
                                                                                                       // 9
var path = Npm.require('path');                                                                        // 10
var MongoDB = Npm.require('mongodb');                                                                  // 11
var Fiber = Npm.require('fibers');                                                                     // 12
var Future = Npm.require(path.join('fibers', 'future'));                                               // 13
                                                                                                       // 14
MongoInternals = {};                                                                                   // 15
MongoTest = {};                                                                                        // 16
                                                                                                       // 17
var replaceNames = function (filter, thing) {                                                          // 18
  if (typeof thing === "object") {                                                                     // 19
    // XXX This condition should match our `looksLikeArray` condition in                               // 20
    // underscore. (A Buffer might not be the only thing that should be                                // 21
    // treated as an array.)                                                                           // 22
    if (_.isArray(thing) || thing instanceof Buffer) {                                                 // 23
      return _.map(thing, _.bind(replaceNames, null, filter));                                         // 24
    }                                                                                                  // 25
    var ret = {};                                                                                      // 26
    _.each(thing, function (value, key) {                                                              // 27
      ret[filter(key)] = replaceNames(filter, value);                                                  // 28
    });                                                                                                // 29
    return ret;                                                                                        // 30
  }                                                                                                    // 31
  return thing;                                                                                        // 32
};                                                                                                     // 33
                                                                                                       // 34
// Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just                           // 35
// doing a structural clone).                                                                          // 36
// XXX how ok is this? what if there are multiple copies of MongoDB loaded?                            // 37
MongoDB.Timestamp.prototype.clone = function () {                                                      // 38
  // Timestamps should be immutable.                                                                   // 39
  return this;                                                                                         // 40
};                                                                                                     // 41
                                                                                                       // 42
var makeMongoLegal = function (name) { return "EJSON" + name; };                                       // 43
var unmakeMongoLegal = function (name) { return name.substr(5); };                                     // 44
                                                                                                       // 45
var replaceMongoAtomWithMeteor = function (document) {                                                 // 46
  if (document instanceof MongoDB.Binary) {                                                            // 47
    var buffer = document.value(true);                                                                 // 48
    return new Uint8Array(buffer);                                                                     // 49
  }                                                                                                    // 50
  if (document instanceof MongoDB.ObjectID) {                                                          // 51
    return new Meteor.Collection.ObjectID(document.toHexString());                                     // 52
  }                                                                                                    // 53
  if (document["EJSON$type"] && document["EJSON$value"]) {                                             // 54
    return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));                              // 55
  }                                                                                                    // 56
  if (document instanceof MongoDB.Timestamp) {                                                         // 57
    // For now, the Meteor representation of a Mongo timestamp type (not a date!                       // 58
    // this is a weird internal thing used in the oplog!) is the same as the                           // 59
    // Mongo representation. We need to do this explicitly or else we would do a                       // 60
    // structural clone and lose the prototype.                                                        // 61
    return document;                                                                                   // 62
  }                                                                                                    // 63
  return undefined;                                                                                    // 64
};                                                                                                     // 65
                                                                                                       // 66
var replaceMeteorAtomWithMongo = function (document) {                                                 // 67
  if (EJSON.isBinary(document)) {                                                                      // 68
    // This does more copies than we'd like, but is necessary because                                  // 69
    // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually                        // 70
    // serialize it correctly).                                                                        // 71
    return new MongoDB.Binary(new Buffer(document));                                                   // 72
  }                                                                                                    // 73
  if (document instanceof Meteor.Collection.ObjectID) {                                                // 74
    return new MongoDB.ObjectID(document.toHexString());                                               // 75
  }                                                                                                    // 76
  if (document instanceof MongoDB.Timestamp) {                                                         // 77
    // For now, the Meteor representation of a Mongo timestamp type (not a date!                       // 78
    // this is a weird internal thing used in the oplog!) is the same as the                           // 79
    // Mongo representation. We need to do this explicitly or else we would do a                       // 80
    // structural clone and lose the prototype.                                                        // 81
    return document;                                                                                   // 82
  }                                                                                                    // 83
  if (EJSON._isCustomType(document)) {                                                                 // 84
    return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));                                  // 85
  }                                                                                                    // 86
  // It is not ordinarily possible to stick dollar-sign keys into mongo                                // 87
  // so we don't bother checking for things that need escaping at this time.                           // 88
  return undefined;                                                                                    // 89
};                                                                                                     // 90
                                                                                                       // 91
var replaceTypes = function (document, atomTransformer) {                                              // 92
  if (typeof document !== 'object' || document === null)                                               // 93
    return document;                                                                                   // 94
                                                                                                       // 95
  var replacedTopLevelAtom = atomTransformer(document);                                                // 96
  if (replacedTopLevelAtom !== undefined)                                                              // 97
    return replacedTopLevelAtom;                                                                       // 98
                                                                                                       // 99
  var ret = document;                                                                                  // 100
  _.each(document, function (val, key) {                                                               // 101
    var valReplaced = replaceTypes(val, atomTransformer);                                              // 102
    if (val !== valReplaced) {                                                                         // 103
      // Lazy clone. Shallow copy.                                                                     // 104
      if (ret === document)                                                                            // 105
        ret = _.clone(document);                                                                       // 106
      ret[key] = valReplaced;                                                                          // 107
    }                                                                                                  // 108
  });                                                                                                  // 109
  return ret;                                                                                          // 110
};                                                                                                     // 111
                                                                                                       // 112
                                                                                                       // 113
MongoConnection = function (url, options) {                                                            // 114
  var self = this;                                                                                     // 115
  options = options || {};                                                                             // 116
  self._connectCallbacks = [];                                                                         // 117
  self._observeMultiplexers = {};                                                                      // 118
  self._onFailoverHook = new Hook;                                                                     // 119
                                                                                                       // 120
  var mongoOptions = {db: {safe: true}, server: {}, replSet: {}};                                      // 121
                                                                                                       // 122
  // Set autoReconnect to true, unless passed on the URL. Why someone                                  // 123
  // would want to set autoReconnect to false, I'm not really sure, but                                // 124
  // keeping this for backwards compatibility for now.                                                 // 125
  if (!(/[\?&]auto_?[rR]econnect=/.test(url))) {                                                       // 126
    mongoOptions.server.auto_reconnect = true;                                                         // 127
  }                                                                                                    // 128
                                                                                                       // 129
  // Disable the native parser by default, unless specifically enabled                                 // 130
  // in the mongo URL.                                                                                 // 131
  // - The native driver can cause errors which normally would be                                      // 132
  //   thrown, caught, and handled into segfaults that take down the                                   // 133
  //   whole app.                                                                                      // 134
  // - Binary modules don't yet work when you bundle and move the bundle                               // 135
  //   to a different platform (aka deploy)                                                            // 136
  // We should revisit this after binary npm module support lands.                                     // 137
  if (!(/[\?&]native_?[pP]arser=/.test(url))) {                                                        // 138
    mongoOptions.db.native_parser = false;                                                             // 139
  }                                                                                                    // 140
                                                                                                       // 141
  // XXX maybe we should have a better way of allowing users to configure the                          // 142
  // underlying Mongo driver                                                                           // 143
  if (_.has(options, 'poolSize')) {                                                                    // 144
    // If we just set this for "server", replSet will override it. If we just                          // 145
    // set it for replSet, it will be ignored if we're not using a replSet.                            // 146
    mongoOptions.server.poolSize = options.poolSize;                                                   // 147
    mongoOptions.replSet.poolSize = options.poolSize;                                                  // 148
  }                                                                                                    // 149
                                                                                                       // 150
  MongoDB.connect(url, mongoOptions, Meteor.bindEnvironment(function(err, db) {                        // 151
    if (err)                                                                                           // 152
      throw err;                                                                                       // 153
    self.db = db;                                                                                      // 154
    // We keep track of the ReplSet's primary, so that we can trigger hooks when                       // 155
    // it changes.  The Node driver's joined callback seems to fire way too                            // 156
    // often, which is why we need to track it ourselves.                                              // 157
    self._primary = null;                                                                              // 158
    // First, figure out what the current primary is, if any.                                          // 159
    if (self.db.serverConfig._state.master)                                                            // 160
      self._primary = self.db.serverConfig._state.master.name;                                         // 161
    self.db.serverConfig.on(                                                                           // 162
      'joined', Meteor.bindEnvironment(function (kind, doc) {                                          // 163
        if (kind === 'primary') {                                                                      // 164
          if (doc.primary !== self._primary) {                                                         // 165
            self._primary = doc.primary;                                                               // 166
            self._onFailoverHook.each(function (callback) {                                            // 167
              callback();                                                                              // 168
              return true;                                                                             // 169
            });                                                                                        // 170
          }                                                                                            // 171
        } else if (doc.me === self._primary) {                                                         // 172
          // The thing we thought was primary is now something other than                              // 173
          // primary.  Forget that we thought it was primary.  (This means that                        // 174
          // if a server stops being primary and then starts being primary again                       // 175
          // without another server becoming primary in the middle, we'll                              // 176
          // correctly count it as a failover.)                                                        // 177
          self._primary = null;                                                                        // 178
        }                                                                                              // 179
    }));                                                                                               // 180
                                                                                                       // 181
    // drain queue of pending callbacks                                                                // 182
    _.each(self._connectCallbacks, function (c) {                                                      // 183
      c(db);                                                                                           // 184
    });                                                                                                // 185
  }));                                                                                                 // 186
                                                                                                       // 187
  self._docFetcher = new DocFetcher(self);                                                             // 188
  self._oplogHandle = null;                                                                            // 189
                                                                                                       // 190
  if (options.oplogUrl && !Package['disable-oplog']) {                                                 // 191
    var dbNameFuture = new Future;                                                                     // 192
    self._withDb(function (db) {                                                                       // 193
      dbNameFuture.return(db.databaseName);                                                            // 194
    });                                                                                                // 195
    self._oplogHandle = new OplogHandle(options.oplogUrl, dbNameFuture.wait());                        // 196
  }                                                                                                    // 197
};                                                                                                     // 198
                                                                                                       // 199
MongoConnection.prototype.close = function() {                                                         // 200
  var self = this;                                                                                     // 201
                                                                                                       // 202
  // XXX probably untested                                                                             // 203
  var oplogHandle = self._oplogHandle;                                                                 // 204
  self._oplogHandle = null;                                                                            // 205
  if (oplogHandle)                                                                                     // 206
    oplogHandle.stop();                                                                                // 207
                                                                                                       // 208
  // Use Future.wrap so that errors get thrown. This happens to                                        // 209
  // work even outside a fiber since the 'close' method is not                                         // 210
  // actually asynchronous.                                                                            // 211
  Future.wrap(_.bind(self.db.close, self.db))(true).wait();                                            // 212
};                                                                                                     // 213
                                                                                                       // 214
MongoConnection.prototype._withDb = function (callback) {                                              // 215
  var self = this;                                                                                     // 216
  if (self.db) {                                                                                       // 217
    callback(self.db);                                                                                 // 218
  } else {                                                                                             // 219
    self._connectCallbacks.push(callback);                                                             // 220
  }                                                                                                    // 221
};                                                                                                     // 222
                                                                                                       // 223
// Returns the Mongo Collection object; may yield.                                                     // 224
MongoConnection.prototype._getCollection = function (collectionName) {                                 // 225
  var self = this;                                                                                     // 226
                                                                                                       // 227
  var future = new Future;                                                                             // 228
  self._withDb(function (db) {                                                                         // 229
    db.collection(collectionName, future.resolver());                                                  // 230
  });                                                                                                  // 231
  return future.wait();                                                                                // 232
};                                                                                                     // 233
                                                                                                       // 234
MongoConnection.prototype._createCappedCollection = function (collectionName,                          // 235
                                                              byteSize) {                              // 236
  var self = this;                                                                                     // 237
  var future = new Future();                                                                           // 238
  self._withDb(function (db) {                                                                         // 239
    db.createCollection(collectionName, {capped: true, size: byteSize},                                // 240
                        future.resolver());                                                            // 241
  });                                                                                                  // 242
  future.wait();                                                                                       // 243
};                                                                                                     // 244
                                                                                                       // 245
// This should be called synchronously with a write, to create a                                       // 246
// transaction on the current write fence, if any. After we can read                                   // 247
// the write, and after observers have been notified (or at least,                                     // 248
// after the observer notifiers have added themselves to the write                                     // 249
// fence), you should call 'committed()' on the object returned.                                       // 250
MongoConnection.prototype._maybeBeginWrite = function () {                                             // 251
  var self = this;                                                                                     // 252
  var fence = DDPServer._CurrentWriteFence.get();                                                      // 253
  if (fence)                                                                                           // 254
    return fence.beginWrite();                                                                         // 255
  else                                                                                                 // 256
    return {committed: function () {}};                                                                // 257
};                                                                                                     // 258
                                                                                                       // 259
// Internal interface: adds a callback which is called when the Mongo primary                          // 260
// changes. Returns a stop handle.                                                                     // 261
MongoConnection.prototype._onFailover = function (callback) {                                          // 262
  return this._onFailoverHook.register(callback);                                                      // 263
};                                                                                                     // 264
                                                                                                       // 265
                                                                                                       // 266
//////////// Public API //////////                                                                     // 267
                                                                                                       // 268
// The write methods block until the database has confirmed the write (it may                          // 269
// not be replicated or stable on disk, but one server has confirmed it) if no                         // 270
// callback is provided. If a callback is provided, then they call the callback                        // 271
// when the write is confirmed. They return nothing on success, and raise an                           // 272
// exception on failure.                                                                               // 273
//                                                                                                     // 274
// After making a write (with insert, update, remove), observers are                                   // 275
// notified asynchronously. If you want to receive a callback once all                                 // 276
// of the observer notifications have landed for your write, do the                                    // 277
// writes inside a write fence (set DDPServer._CurrentWriteFence to a new                              // 278
// _WriteFence, and then set a callback on the write fence.)                                           // 279
//                                                                                                     // 280
// Since our execution environment is single-threaded, this is                                         // 281
// well-defined -- a write "has been made" if it's returned, and an                                    // 282
// observer "has been notified" if its callback has returned.                                          // 283
                                                                                                       // 284
var writeCallback = function (write, refresh, callback) {                                              // 285
  return function (err, result) {                                                                      // 286
    if (! err) {                                                                                       // 287
      // XXX We don't have to run this on error, right?                                                // 288
      refresh();                                                                                       // 289
    }                                                                                                  // 290
    write.committed();                                                                                 // 291
    if (callback)                                                                                      // 292
      callback(err, result);                                                                           // 293
    else if (err)                                                                                      // 294
      throw err;                                                                                       // 295
  };                                                                                                   // 296
};                                                                                                     // 297
                                                                                                       // 298
var bindEnvironmentForWrite = function (callback) {                                                    // 299
  return Meteor.bindEnvironment(callback, "Mongo write");                                              // 300
};                                                                                                     // 301
                                                                                                       // 302
MongoConnection.prototype._insert = function (collection_name, document,                               // 303
                                              callback) {                                              // 304
  var self = this;                                                                                     // 305
  if (collection_name === "___meteor_failure_test_collection") {                                       // 306
    var e = new Error("Failure test");                                                                 // 307
    e.expected = true;                                                                                 // 308
    if (callback)                                                                                      // 309
      return callback(e);                                                                              // 310
    else                                                                                               // 311
      throw e;                                                                                         // 312
  }                                                                                                    // 313
                                                                                                       // 314
  var write = self._maybeBeginWrite();                                                                 // 315
  var refresh = function () {                                                                          // 316
    Meteor.refresh({collection: collection_name, id: document._id });                                  // 317
  };                                                                                                   // 318
  callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));                         // 319
  try {                                                                                                // 320
    var collection = self._getCollection(collection_name);                                             // 321
    collection.insert(replaceTypes(document, replaceMeteorAtomWithMongo),                              // 322
                      {safe: true}, callback);                                                         // 323
  } catch (e) {                                                                                        // 324
    write.committed();                                                                                 // 325
    throw e;                                                                                           // 326
  }                                                                                                    // 327
};                                                                                                     // 328
                                                                                                       // 329
// Cause queries that may be affected by the selector to poll in this write                            // 330
// fence.                                                                                              // 331
MongoConnection.prototype._refresh = function (collectionName, selector) {                             // 332
  var self = this;                                                                                     // 333
  var refreshKey = {collection: collectionName};                                                       // 334
  // If we know which documents we're removing, don't poll queries that are                            // 335
  // specific to other documents. (Note that multiple notifications here should                        // 336
  // not cause multiple polls, since all our listener is doing is enqueueing a                         // 337
  // poll.)                                                                                            // 338
  var specificIds = LocalCollection._idsMatchedBySelector(selector);                                   // 339
  if (specificIds) {                                                                                   // 340
    _.each(specificIds, function (id) {                                                                // 341
      Meteor.refresh(_.extend({id: id}, refreshKey));                                                  // 342
    });                                                                                                // 343
  } else {                                                                                             // 344
    Meteor.refresh(refreshKey);                                                                        // 345
  }                                                                                                    // 346
};                                                                                                     // 347
                                                                                                       // 348
MongoConnection.prototype._remove = function (collection_name, selector,                               // 349
                                              callback) {                                              // 350
  var self = this;                                                                                     // 351
                                                                                                       // 352
  if (collection_name === "___meteor_failure_test_collection") {                                       // 353
    var e = new Error("Failure test");                                                                 // 354
    e.expected = true;                                                                                 // 355
    if (callback)                                                                                      // 356
      return callback(e);                                                                              // 357
    else                                                                                               // 358
      throw e;                                                                                         // 359
  }                                                                                                    // 360
                                                                                                       // 361
  var write = self._maybeBeginWrite();                                                                 // 362
  var refresh = function () {                                                                          // 363
    self._refresh(collection_name, selector);                                                          // 364
  };                                                                                                   // 365
  callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));                         // 366
                                                                                                       // 367
  try {                                                                                                // 368
    var collection = self._getCollection(collection_name);                                             // 369
    collection.remove(replaceTypes(selector, replaceMeteorAtomWithMongo),                              // 370
                      {safe: true}, callback);                                                         // 371
  } catch (e) {                                                                                        // 372
    write.committed();                                                                                 // 373
    throw e;                                                                                           // 374
  }                                                                                                    // 375
};                                                                                                     // 376
                                                                                                       // 377
MongoConnection.prototype._dropCollection = function (collectionName, cb) {                            // 378
  var self = this;                                                                                     // 379
                                                                                                       // 380
  var write = self._maybeBeginWrite();                                                                 // 381
  var refresh = function () {                                                                          // 382
    Meteor.refresh({collection: collectionName, id: null,                                              // 383
                    dropCollection: true});                                                            // 384
  };                                                                                                   // 385
  cb = bindEnvironmentForWrite(writeCallback(write, refresh, cb));                                     // 386
                                                                                                       // 387
  try {                                                                                                // 388
    var collection = self._getCollection(collectionName);                                              // 389
    collection.drop(cb);                                                                               // 390
  } catch (e) {                                                                                        // 391
    write.committed();                                                                                 // 392
    throw e;                                                                                           // 393
  }                                                                                                    // 394
};                                                                                                     // 395
                                                                                                       // 396
MongoConnection.prototype._update = function (collection_name, selector, mod,                          // 397
                                              options, callback) {                                     // 398
  var self = this;                                                                                     // 399
                                                                                                       // 400
  if (! callback && options instanceof Function) {                                                     // 401
    callback = options;                                                                                // 402
    options = null;                                                                                    // 403
  }                                                                                                    // 404
                                                                                                       // 405
  if (collection_name === "___meteor_failure_test_collection") {                                       // 406
    var e = new Error("Failure test");                                                                 // 407
    e.expected = true;                                                                                 // 408
    if (callback)                                                                                      // 409
      return callback(e);                                                                              // 410
    else                                                                                               // 411
      throw e;                                                                                         // 412
  }                                                                                                    // 413
                                                                                                       // 414
  // explicit safety check. null and undefined can crash the mongo                                     // 415
  // driver. Although the node driver and minimongo do 'support'                                       // 416
  // non-object modifier in that they don't crash, they are not                                        // 417
  // meaningful operations and do not do anything. Defensively throw an                                // 418
  // error here.                                                                                       // 419
  if (!mod || typeof mod !== 'object')                                                                 // 420
    throw new Error("Invalid modifier. Modifier must be an object.");                                  // 421
                                                                                                       // 422
  if (!options) options = {};                                                                          // 423
                                                                                                       // 424
  var write = self._maybeBeginWrite();                                                                 // 425
  var refresh = function () {                                                                          // 426
    self._refresh(collection_name, selector);                                                          // 427
  };                                                                                                   // 428
  callback = writeCallback(write, refresh, callback);                                                  // 429
  try {                                                                                                // 430
    var collection = self._getCollection(collection_name);                                             // 431
    var mongoOpts = {safe: true};                                                                      // 432
    // explictly enumerate options that minimongo supports                                             // 433
    if (options.upsert) mongoOpts.upsert = true;                                                       // 434
    if (options.multi) mongoOpts.multi = true;                                                         // 435
                                                                                                       // 436
    var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);                            // 437
    var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);                                      // 438
                                                                                                       // 439
    var isModify = isModificationMod(mongoMod);                                                        // 440
    var knownId = (isModify ? selector._id : mod._id);                                                 // 441
                                                                                                       // 442
    if (options.upsert && (! knownId) && options.insertedId) {                                         // 443
      // XXX In future we could do a real upsert for the mongo id generation                           // 444
      // case, if the the node mongo driver gives us back the id of the upserted                       // 445
      // doc (which our current version does not).                                                     // 446
      simulateUpsertWithInsertedId(                                                                    // 447
        collection, mongoSelector, mongoMod,                                                           // 448
        isModify, options,                                                                             // 449
        // This callback does not need to be bindEnvironment'ed because                                // 450
        // simulateUpsertWithInsertedId() wraps it and then passes it through                          // 451
        // bindEnvironmentForWrite.                                                                    // 452
        function (err, result) {                                                                       // 453
          // If we got here via a upsert() call, then options._returnObject will                       // 454
          // be set and we should return the whole object. Otherwise, we should                        // 455
          // just return the number of affected docs to match the mongo API.                           // 456
          if (result && ! options._returnObject)                                                       // 457
            callback(err, result.numberAffected);                                                      // 458
          else                                                                                         // 459
            callback(err, result);                                                                     // 460
        }                                                                                              // 461
      );                                                                                               // 462
    } else {                                                                                           // 463
      collection.update(                                                                               // 464
        mongoSelector, mongoMod, mongoOpts,                                                            // 465
        bindEnvironmentForWrite(function (err, result, extra) {                                        // 466
          if (! err) {                                                                                 // 467
            if (result && options._returnObject) {                                                     // 468
              result = { numberAffected: result };                                                     // 469
              // If this was an upsert() call, and we ended up                                         // 470
              // inserting a new doc and we know its id, then                                          // 471
              // return that id as well.                                                               // 472
              if (options.upsert && knownId &&                                                         // 473
                  ! extra.updatedExisting)                                                             // 474
                result.insertedId = knownId;                                                           // 475
            }                                                                                          // 476
          }                                                                                            // 477
          callback(err, result);                                                                       // 478
        }));                                                                                           // 479
    }                                                                                                  // 480
  } catch (e) {                                                                                        // 481
    write.committed();                                                                                 // 482
    throw e;                                                                                           // 483
  }                                                                                                    // 484
};                                                                                                     // 485
                                                                                                       // 486
var isModificationMod = function (mod) {                                                               // 487
  for (var k in mod)                                                                                   // 488
    if (k.substr(0, 1) === '$')                                                                        // 489
      return true;                                                                                     // 490
  return false;                                                                                        // 491
};                                                                                                     // 492
                                                                                                       // 493
var NUM_OPTIMISTIC_TRIES = 3;                                                                          // 494
                                                                                                       // 495
// exposed for testing                                                                                 // 496
MongoConnection._isCannotChangeIdError = function (err) {                                              // 497
  // either of these checks should work, but just to be safe...                                        // 498
  return (err.code === 13596 ||                                                                        // 499
          err.err.indexOf("cannot change _id of a document") === 0);                                   // 500
};                                                                                                     // 501
                                                                                                       // 502
var simulateUpsertWithInsertedId = function (collection, selector, mod,                                // 503
                                             isModify, options, callback) {                            // 504
  // STRATEGY:  First try doing a plain update.  If it affected 0 documents,                           // 505
  // then without affecting the database, we know we should probably do an                             // 506
  // insert.  We then do a *conditional* insert that will fail in the case                             // 507
  // of a race condition.  This conditional insert is actually an                                      // 508
  // upsert-replace with an _id, which will never successfully update an                               // 509
  // existing document.  If this upsert fails with an error saying it                                  // 510
  // couldn't change an existing _id, then we know an intervening write has                            // 511
  // caused the query to match something.  We go back to step one and repeat.                          // 512
  // Like all "optimistic write" schemes, we rely on the fact that it's                                // 513
  // unlikely our writes will continue to be interfered with under normal                              // 514
  // circumstances (though sufficiently heavy contention with writers                                  // 515
  // disagreeing on the existence of an object will cause writes to fail                               // 516
  // in theory).                                                                                       // 517
                                                                                                       // 518
  var newDoc;                                                                                          // 519
  // Run this code up front so that it fails fast if someone uses                                      // 520
  // a Mongo update operator we don't support.                                                         // 521
  if (isModify) {                                                                                      // 522
    // We've already run replaceTypes/replaceMeteorAtomWithMongo on                                    // 523
    // selector and mod.  We assume it doesn't matter, as far as                                       // 524
    // the behavior of modifiers is concerned, whether `_modify`                                       // 525
    // is run on EJSON or on mongo-converted EJSON.                                                    // 526
    var selectorDoc = LocalCollection._removeDollarOperators(selector);                                // 527
    LocalCollection._modify(selectorDoc, mod, {isInsert: true});                                       // 528
    newDoc = selectorDoc;                                                                              // 529
  } else {                                                                                             // 530
    newDoc = mod;                                                                                      // 531
  }                                                                                                    // 532
                                                                                                       // 533
  var insertedId = options.insertedId; // must exist                                                   // 534
  var mongoOptsForUpdate = {                                                                           // 535
    safe: true,                                                                                        // 536
    multi: options.multi                                                                               // 537
  };                                                                                                   // 538
  var mongoOptsForInsert = {                                                                           // 539
    safe: true,                                                                                        // 540
    upsert: true                                                                                       // 541
  };                                                                                                   // 542
                                                                                                       // 543
  var tries = NUM_OPTIMISTIC_TRIES;                                                                    // 544
                                                                                                       // 545
  var doUpdate = function () {                                                                         // 546
    tries--;                                                                                           // 547
    if (! tries) {                                                                                     // 548
      callback(new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries."));                  // 549
    } else {                                                                                           // 550
      collection.update(selector, mod, mongoOptsForUpdate,                                             // 551
                        bindEnvironmentForWrite(function (err, result) {                               // 552
                          if (err)                                                                     // 553
                            callback(err);                                                             // 554
                          else if (result)                                                             // 555
                            callback(null, {                                                           // 556
                              numberAffected: result                                                   // 557
                            });                                                                        // 558
                          else                                                                         // 559
                            doConditionalInsert();                                                     // 560
                        }));                                                                           // 561
    }                                                                                                  // 562
  };                                                                                                   // 563
                                                                                                       // 564
  var doConditionalInsert = function () {                                                              // 565
    var replacementWithId = _.extend(                                                                  // 566
      replaceTypes({_id: insertedId}, replaceMeteorAtomWithMongo),                                     // 567
      newDoc);                                                                                         // 568
    collection.update(selector, replacementWithId, mongoOptsForInsert,                                 // 569
                      bindEnvironmentForWrite(function (err, result) {                                 // 570
                        if (err) {                                                                     // 571
                          // figure out if this is a                                                   // 572
                          // "cannot change _id of document" error, and                                // 573
                          // if so, try doUpdate() again, up to 3 times.                               // 574
                          if (MongoConnection._isCannotChangeIdError(err)) {                           // 575
                            doUpdate();                                                                // 576
                          } else {                                                                     // 577
                            callback(err);                                                             // 578
                          }                                                                            // 579
                        } else {                                                                       // 580
                          callback(null, {                                                             // 581
                            numberAffected: result,                                                    // 582
                            insertedId: insertedId                                                     // 583
                          });                                                                          // 584
                        }                                                                              // 585
                      }));                                                                             // 586
  };                                                                                                   // 587
                                                                                                       // 588
  doUpdate();                                                                                          // 589
};                                                                                                     // 590
                                                                                                       // 591
_.each(["insert", "update", "remove", "dropCollection"], function (method) {                           // 592
  MongoConnection.prototype[method] = function (/* arguments */) {                                     // 593
    var self = this;                                                                                   // 594
    return Meteor._wrapAsync(self["_" + method]).apply(self, arguments);                               // 595
  };                                                                                                   // 596
});                                                                                                    // 597
                                                                                                       // 598
// XXX MongoConnection.upsert() does not return the id of the inserted document                        // 599
// unless you set it explicitly in the selector or modifier (as a replacement                          // 600
// doc).                                                                                               // 601
MongoConnection.prototype.upsert = function (collectionName, selector, mod,                            // 602
                                             options, callback) {                                      // 603
  var self = this;                                                                                     // 604
  if (typeof options === "function" && ! callback) {                                                   // 605
    callback = options;                                                                                // 606
    options = {};                                                                                      // 607
  }                                                                                                    // 608
                                                                                                       // 609
  return self.update(collectionName, selector, mod,                                                    // 610
                     _.extend({}, options, {                                                           // 611
                       upsert: true,                                                                   // 612
                       _returnObject: true                                                             // 613
                     }), callback);                                                                    // 614
};                                                                                                     // 615
                                                                                                       // 616
MongoConnection.prototype.find = function (collectionName, selector, options) {                        // 617
  var self = this;                                                                                     // 618
                                                                                                       // 619
  if (arguments.length === 1)                                                                          // 620
    selector = {};                                                                                     // 621
                                                                                                       // 622
  return new Cursor(                                                                                   // 623
    self, new CursorDescription(collectionName, selector, options));                                   // 624
};                                                                                                     // 625
                                                                                                       // 626
MongoConnection.prototype.findOne = function (collection_name, selector,                               // 627
                                              options) {                                               // 628
  var self = this;                                                                                     // 629
  if (arguments.length === 1)                                                                          // 630
    selector = {};                                                                                     // 631
                                                                                                       // 632
  options = options || {};                                                                             // 633
  options.limit = 1;                                                                                   // 634
  return self.find(collection_name, selector, options).fetch()[0];                                     // 635
};                                                                                                     // 636
                                                                                                       // 637
// We'll actually design an index API later. For now, we just pass through to                          // 638
// Mongo's, but make it synchronous.                                                                   // 639
MongoConnection.prototype._ensureIndex = function (collectionName, index,                              // 640
                                                   options) {                                          // 641
  var self = this;                                                                                     // 642
  options = _.extend({safe: true}, options);                                                           // 643
                                                                                                       // 644
  // We expect this function to be called at startup, not from within a method,                        // 645
  // so we don't interact with the write fence.                                                        // 646
  var collection = self._getCollection(collectionName);                                                // 647
  var future = new Future;                                                                             // 648
  var indexName = collection.ensureIndex(index, options, future.resolver());                           // 649
  future.wait();                                                                                       // 650
};                                                                                                     // 651
MongoConnection.prototype._dropIndex = function (collectionName, index) {                              // 652
  var self = this;                                                                                     // 653
                                                                                                       // 654
  // This function is only used by test code, not within a method, so we don't                         // 655
  // interact with the write fence.                                                                    // 656
  var collection = self._getCollection(collectionName);                                                // 657
  var future = new Future;                                                                             // 658
  var indexName = collection.dropIndex(index, future.resolver());                                      // 659
  future.wait();                                                                                       // 660
};                                                                                                     // 661
                                                                                                       // 662
// CURSORS                                                                                             // 663
                                                                                                       // 664
// There are several classes which relate to cursors:                                                  // 665
//                                                                                                     // 666
// CursorDescription represents the arguments used to construct a cursor:                              // 667
// collectionName, selector, and (find) options.  Because it is used as a key                          // 668
// for cursor de-dup, everything in it should either be JSON-stringifiable or                          // 669
// not affect observeChanges output (eg, options.transform functions are not                           // 670
// stringifiable but do not affect observeChanges).                                                    // 671
//                                                                                                     // 672
// SynchronousCursor is a wrapper around a MongoDB cursor                                              // 673
// which includes fully-synchronous versions of forEach, etc.                                          // 674
//                                                                                                     // 675
// Cursor is the cursor object returned from find(), which implements the                              // 676
// documented Meteor.Collection cursor API.  It wraps a CursorDescription and a                        // 677
// SynchronousCursor (lazily: it doesn't contact Mongo until you call a method                         // 678
// like fetch or forEach on it).                                                                       // 679
//                                                                                                     // 680
// ObserveHandle is the "observe handle" returned from observeChanges. It has a                        // 681
// reference to an ObserveMultiplexer.                                                                 // 682
//                                                                                                     // 683
// ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a                       // 684
// single observe driver.                                                                              // 685
//                                                                                                     // 686
// There are two "observe drivers" which drive ObserveMultiplexers:                                    // 687
//   - PollingObserveDriver caches the results of a query and reruns it when                           // 688
//     necessary.                                                                                      // 689
//   - OplogObserveDriver follows the Mongo operation log to directly observe                          // 690
//     database changes.                                                                               // 691
// Both implementations follow the same simple interface: when you create them,                        // 692
// they start sending observeChanges callbacks (and a ready() invocation) to                           // 693
// their ObserveMultiplexer, and you stop them by calling their stop() method.                         // 694
                                                                                                       // 695
CursorDescription = function (collectionName, selector, options) {                                     // 696
  var self = this;                                                                                     // 697
  self.collectionName = collectionName;                                                                // 698
  self.selector = Meteor.Collection._rewriteSelector(selector);                                        // 699
  self.options = options || {};                                                                        // 700
};                                                                                                     // 701
                                                                                                       // 702
Cursor = function (mongo, cursorDescription) {                                                         // 703
  var self = this;                                                                                     // 704
                                                                                                       // 705
  self._mongo = mongo;                                                                                 // 706
  self._cursorDescription = cursorDescription;                                                         // 707
  self._synchronousCursor = null;                                                                      // 708
};                                                                                                     // 709
                                                                                                       // 710
_.each(['forEach', 'map', 'rewind', 'fetch', 'count'], function (method) {                             // 711
  Cursor.prototype[method] = function () {                                                             // 712
    var self = this;                                                                                   // 713
                                                                                                       // 714
    // You can only observe a tailable cursor.                                                         // 715
    if (self._cursorDescription.options.tailable)                                                      // 716
      throw new Error("Cannot call " + method + " on a tailable cursor");                              // 717
                                                                                                       // 718
    if (!self._synchronousCursor) {                                                                    // 719
      self._synchronousCursor = self._mongo._createSynchronousCursor(                                  // 720
        self._cursorDescription, {                                                                     // 721
          // Make sure that the "self" argument to forEach/map callbacks is the                        // 722
          // Cursor, not the SynchronousCursor.                                                        // 723
          selfForIteration: self,                                                                      // 724
          useTransform: true                                                                           // 725
        });                                                                                            // 726
    }                                                                                                  // 727
                                                                                                       // 728
    return self._synchronousCursor[method].apply(                                                      // 729
      self._synchronousCursor, arguments);                                                             // 730
  };                                                                                                   // 731
});                                                                                                    // 732
                                                                                                       // 733
Cursor.prototype.getTransform = function () {                                                          // 734
  return this._cursorDescription.options.transform;                                                    // 735
};                                                                                                     // 736
                                                                                                       // 737
// When you call Meteor.publish() with a function that returns a Cursor, we need                       // 738
// to transmute it into the equivalent subscription.  This is the function that                        // 739
// does that.                                                                                          // 740
                                                                                                       // 741
Cursor.prototype._publishCursor = function (sub) {                                                     // 742
  var self = this;                                                                                     // 743
  var collection = self._cursorDescription.collectionName;                                             // 744
  return Meteor.Collection._publishCursor(self, sub, collection);                                      // 745
};                                                                                                     // 746
                                                                                                       // 747
// Used to guarantee that publish functions return at most one cursor per                              // 748
// collection. Private, because we might later have cursors that include                               // 749
// documents from multiple collections somehow.                                                        // 750
Cursor.prototype._getCollectionName = function () {                                                    // 751
  var self = this;                                                                                     // 752
  return self._cursorDescription.collectionName;                                                       // 753
}                                                                                                      // 754
                                                                                                       // 755
Cursor.prototype.observe = function (callbacks) {                                                      // 756
  var self = this;                                                                                     // 757
  return LocalCollection._observeFromObserveChanges(self, callbacks);                                  // 758
};                                                                                                     // 759
                                                                                                       // 760
Cursor.prototype.observeChanges = function (callbacks) {                                               // 761
  var self = this;                                                                                     // 762
  var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);                         // 763
  return self._mongo._observeChanges(                                                                  // 764
    self._cursorDescription, ordered, callbacks);                                                      // 765
};                                                                                                     // 766
                                                                                                       // 767
MongoConnection.prototype._createSynchronousCursor = function(                                         // 768
    cursorDescription, options) {                                                                      // 769
  var self = this;                                                                                     // 770
  options = _.pick(options || {}, 'selfForIteration', 'useTransform');                                 // 771
                                                                                                       // 772
  var collection = self._getCollection(cursorDescription.collectionName);                              // 773
  var cursorOptions = cursorDescription.options;                                                       // 774
  var mongoOptions = {                                                                                 // 775
    sort: cursorOptions.sort,                                                                          // 776
    limit: cursorOptions.limit,                                                                        // 777
    skip: cursorOptions.skip                                                                           // 778
  };                                                                                                   // 779
                                                                                                       // 780
  // Do we want a tailable cursor (which only works on capped collections)?                            // 781
  if (cursorOptions.tailable) {                                                                        // 782
    // We want a tailable cursor...                                                                    // 783
    mongoOptions.tailable = true;                                                                      // 784
    // ... and for the server to wait a bit if any getMore has no data (rather                         // 785
    // than making us put the relevant sleeps in the client)...                                        // 786
    mongoOptions.awaitdata = true;                                                                     // 787
    // ... and to keep querying the server indefinitely rather than just 5 times                       // 788
    // if there's no more data.                                                                        // 789
    mongoOptions.numberOfRetries = -1;                                                                 // 790
    // And if this is on the oplog collection and the cursor specifies a 'ts',                         // 791
    // then set the undocumented oplog replay flag, which does a special scan to                       // 792
    // find the first document (instead of creating an index on ts). This is a                         // 793
    // very hard-coded Mongo flag which only works on the oplog collection and                         // 794
    // only works with the ts field.                                                                   // 795
    if (cursorDescription.collectionName === OPLOG_COLLECTION &&                                       // 796
        cursorDescription.selector.ts) {                                                               // 797
      mongoOptions.oplogReplay = true;                                                                 // 798
    }                                                                                                  // 799
  }                                                                                                    // 800
                                                                                                       // 801
  var dbCursor = collection.find(                                                                      // 802
    replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo),                              // 803
    cursorOptions.fields, mongoOptions);                                                               // 804
                                                                                                       // 805
  return new SynchronousCursor(dbCursor, cursorDescription, options);                                  // 806
};                                                                                                     // 807
                                                                                                       // 808
var SynchronousCursor = function (dbCursor, cursorDescription, options) {                              // 809
  var self = this;                                                                                     // 810
  options = _.pick(options || {}, 'selfForIteration', 'useTransform');                                 // 811
                                                                                                       // 812
  self._dbCursor = dbCursor;                                                                           // 813
  self._cursorDescription = cursorDescription;                                                         // 814
  // The "self" argument passed to forEach/map callbacks. If we're wrapped                             // 815
  // inside a user-visible Cursor, we want to provide the outer cursor!                                // 816
  self._selfForIteration = options.selfForIteration || self;                                           // 817
  if (options.useTransform && cursorDescription.options.transform) {                                   // 818
    self._transform = LocalCollection.wrapTransform(                                                   // 819
      cursorDescription.options.transform);                                                            // 820
  } else {                                                                                             // 821
    self._transform = null;                                                                            // 822
  }                                                                                                    // 823
                                                                                                       // 824
  // Need to specify that the callback is the first argument to nextObject,                            // 825
  // since otherwise when we try to call it with no args the driver will                               // 826
  // interpret "undefined" first arg as an options hash and crash.                                     // 827
  self._synchronousNextObject = Future.wrap(                                                           // 828
    dbCursor.nextObject.bind(dbCursor), 0);                                                            // 829
  self._synchronousCount = Future.wrap(dbCursor.count.bind(dbCursor));                                 // 830
  self._visitedIds = new LocalCollection._IdMap;                                                       // 831
};                                                                                                     // 832
                                                                                                       // 833
_.extend(SynchronousCursor.prototype, {                                                                // 834
  _nextObject: function () {                                                                           // 835
    var self = this;                                                                                   // 836
                                                                                                       // 837
    while (true) {                                                                                     // 838
      var doc = self._synchronousNextObject().wait();                                                  // 839
                                                                                                       // 840
      if (!doc) return null;                                                                           // 841
      doc = replaceTypes(doc, replaceMongoAtomWithMeteor);                                             // 842
                                                                                                       // 843
      if (!self._cursorDescription.options.tailable && _.has(doc, '_id')) {                            // 844
        // Did Mongo give us duplicate documents in the same cursor? If so,                            // 845
        // ignore this one. (Do this before the transform, since transform might                       // 846
        // return some unrelated value.) We don't do this for tailable cursors,                        // 847
        // because we want to maintain O(1) memory usage. And if there isn't _id                       // 848
        // for some reason (maybe it's the oplog), then we don't do this either.                       // 849
        // (Be careful to do this for falsey but existing _id, though.)                                // 850
        if (self._visitedIds.has(doc._id)) continue;                                                   // 851
        self._visitedIds.set(doc._id, true);                                                           // 852
      }                                                                                                // 853
                                                                                                       // 854
      if (self._transform)                                                                             // 855
        doc = self._transform(doc);                                                                    // 856
                                                                                                       // 857
      return doc;                                                                                      // 858
    }                                                                                                  // 859
  },                                                                                                   // 860
                                                                                                       // 861
  forEach: function (callback, thisArg) {                                                              // 862
    var self = this;                                                                                   // 863
                                                                                                       // 864
    // We implement the loop ourself instead of using self._dbCursor.each,                             // 865
    // because "each" will call its callback outside of a fiber which makes it                         // 866
    // much more complex to make this function synchronous.                                            // 867
    var index = 0;                                                                                     // 868
    while (true) {                                                                                     // 869
      var doc = self._nextObject();                                                                    // 870
      if (!doc) return;                                                                                // 871
      callback.call(thisArg, doc, index++, self._selfForIteration);                                    // 872
    }                                                                                                  // 873
  },                                                                                                   // 874
                                                                                                       // 875
  // XXX Allow overlapping callback executions if callback yields.                                     // 876
  map: function (callback, thisArg) {                                                                  // 877
    var self = this;                                                                                   // 878
    var res = [];                                                                                      // 879
    self.forEach(function (doc, index) {                                                               // 880
      res.push(callback.call(thisArg, doc, index, self._selfForIteration));                            // 881
    });                                                                                                // 882
    return res;                                                                                        // 883
  },                                                                                                   // 884
                                                                                                       // 885
  rewind: function () {                                                                                // 886
    var self = this;                                                                                   // 887
                                                                                                       // 888
    // known to be synchronous                                                                         // 889
    self._dbCursor.rewind();                                                                           // 890
                                                                                                       // 891
    self._visitedIds = new LocalCollection._IdMap;                                                     // 892
  },                                                                                                   // 893
                                                                                                       // 894
  // Mostly usable for tailable cursors.                                                               // 895
  close: function () {                                                                                 // 896
    var self = this;                                                                                   // 897
                                                                                                       // 898
    self._dbCursor.close();                                                                            // 899
  },                                                                                                   // 900
                                                                                                       // 901
  fetch: function () {                                                                                 // 902
    var self = this;                                                                                   // 903
    return self.map(_.identity);                                                                       // 904
  },                                                                                                   // 905
                                                                                                       // 906
  count: function () {                                                                                 // 907
    var self = this;                                                                                   // 908
    return self._synchronousCount().wait();                                                            // 909
  },                                                                                                   // 910
                                                                                                       // 911
  // This method is NOT wrapped in Cursor.                                                             // 912
  getRawObjects: function (ordered) {                                                                  // 913
    var self = this;                                                                                   // 914
    if (ordered) {                                                                                     // 915
      return self.fetch();                                                                             // 916
    } else {                                                                                           // 917
      var results = new LocalCollection._IdMap;                                                        // 918
      self.forEach(function (doc) {                                                                    // 919
        results.set(doc._id, doc);                                                                     // 920
      });                                                                                              // 921
      return results;                                                                                  // 922
    }                                                                                                  // 923
  }                                                                                                    // 924
});                                                                                                    // 925
                                                                                                       // 926
MongoConnection.prototype.tail = function (cursorDescription, docCallback) {                           // 927
  var self = this;                                                                                     // 928
  if (!cursorDescription.options.tailable)                                                             // 929
    throw new Error("Can only tail a tailable cursor");                                                // 930
                                                                                                       // 931
  var cursor = self._createSynchronousCursor(cursorDescription);                                       // 932
                                                                                                       // 933
  var stopped = false;                                                                                 // 934
  var lastTS = undefined;                                                                              // 935
  var loop = function () {                                                                             // 936
    while (true) {                                                                                     // 937
      if (stopped)                                                                                     // 938
        return;                                                                                        // 939
      try {                                                                                            // 940
        var doc = cursor._nextObject();                                                                // 941
      } catch (err) {                                                                                  // 942
        // There's no good way to figure out if this was actually an error                             // 943
        // from Mongo. Ah well. But either way, we need to retry the cursor                            // 944
        // (unless the failure was because the observe got stopped).                                   // 945
        doc = null;                                                                                    // 946
      }                                                                                                // 947
      // Since cursor._nextObject can yield, we need to check again to see if                          // 948
      // we've been stopped before calling the callback.                                               // 949
      if (stopped)                                                                                     // 950
        return;                                                                                        // 951
      if (doc) {                                                                                       // 952
        // If a tailable cursor contains a "ts" field, use it to recreate the                          // 953
        // cursor on error. ("ts" is a standard that Mongo uses internally for                         // 954
        // the oplog, and there's a special flag that lets you do binary search                        // 955
        // on it instead of needing to use an index.)                                                  // 956
        lastTS = doc.ts;                                                                               // 957
        docCallback(doc);                                                                              // 958
      } else {                                                                                         // 959
        var newSelector = _.clone(cursorDescription.selector);                                         // 960
        if (lastTS) {                                                                                  // 961
          newSelector.ts = {$gt: lastTS};                                                              // 962
        }                                                                                              // 963
        cursor = self._createSynchronousCursor(new CursorDescription(                                  // 964
          cursorDescription.collectionName,                                                            // 965
          newSelector,                                                                                 // 966
          cursorDescription.options));                                                                 // 967
        // Mongo failover takes many seconds.  Retry in a bit.  (Without this                          // 968
        // setTimeout, we peg the CPU at 100% and never notice the actual                              // 969
        // failover.                                                                                   // 970
        Meteor.setTimeout(loop, 100);                                                                  // 971
        break;                                                                                         // 972
      }                                                                                                // 973
    }                                                                                                  // 974
  };                                                                                                   // 975
                                                                                                       // 976
  Meteor.defer(loop);                                                                                  // 977
                                                                                                       // 978
  return {                                                                                             // 979
    stop: function () {                                                                                // 980
      stopped = true;                                                                                  // 981
      cursor.close();                                                                                  // 982
    }                                                                                                  // 983
  };                                                                                                   // 984
};                                                                                                     // 985
                                                                                                       // 986
MongoConnection.prototype._observeChanges = function (                                                 // 987
    cursorDescription, ordered, callbacks) {                                                           // 988
  var self = this;                                                                                     // 989
                                                                                                       // 990
  if (cursorDescription.options.tailable) {                                                            // 991
    return self._observeChangesTailable(cursorDescription, ordered, callbacks);                        // 992
  }                                                                                                    // 993
                                                                                                       // 994
  // You may not filter out _id when observing changes, because the id is a core                       // 995
  // part of the observeChanges API.                                                                   // 996
  if (cursorDescription.options.fields &&                                                              // 997
      (cursorDescription.options.fields._id === 0 ||                                                   // 998
       cursorDescription.options.fields._id === false)) {                                              // 999
    throw Error("You may not observe a cursor with {fields: {_id: 0}}");                               // 1000
  }                                                                                                    // 1001
                                                                                                       // 1002
  var observeKey = JSON.stringify(                                                                     // 1003
    _.extend({ordered: ordered}, cursorDescription));                                                  // 1004
                                                                                                       // 1005
  var multiplexer, observeDriver;                                                                      // 1006
  var firstHandle = false;                                                                             // 1007
                                                                                                       // 1008
  // Find a matching ObserveMultiplexer, or create a new one. This next block is                       // 1009
  // guaranteed to not yield (and it doesn't call anything that can observe a                          // 1010
  // new query), so no other calls to this function can interleave with it.                            // 1011
  Meteor._noYieldsAllowed(function () {                                                                // 1012
    if (_.has(self._observeMultiplexers, observeKey)) {                                                // 1013
      multiplexer = self._observeMultiplexers[observeKey];                                             // 1014
    } else {                                                                                           // 1015
      firstHandle = true;                                                                              // 1016
      // Create a new ObserveMultiplexer.                                                              // 1017
      multiplexer = new ObserveMultiplexer({                                                           // 1018
        ordered: ordered,                                                                              // 1019
        onStop: function () {                                                                          // 1020
          observeDriver.stop();                                                                        // 1021
          delete self._observeMultiplexers[observeKey];                                                // 1022
        }                                                                                              // 1023
      });                                                                                              // 1024
      self._observeMultiplexers[observeKey] = multiplexer;                                             // 1025
    }                                                                                                  // 1026
  });                                                                                                  // 1027
                                                                                                       // 1028
  var observeHandle = new ObserveHandle(multiplexer, callbacks);                                       // 1029
                                                                                                       // 1030
  if (firstHandle) {                                                                                   // 1031
    var matcher, sorter;                                                                               // 1032
    var canUseOplog = _.all([                                                                          // 1033
      function () {                                                                                    // 1034
        // At a bare minimum, using the oplog requires us to have an oplog, to                         // 1035
        // want unordered callbacks, and to not want a callback on the polls                           // 1036
        // that won't happen.                                                                          // 1037
        return self._oplogHandle && !ordered &&                                                        // 1038
          !callbacks._testOnlyPollCallback;                                                            // 1039
      }, function () {                                                                                 // 1040
        // We need to be able to compile the selector. Fall back to polling for                        // 1041
        // some newfangled $selector that minimongo doesn't support yet.                               // 1042
        try {                                                                                          // 1043
          matcher = new Minimongo.Matcher(cursorDescription.selector);                                 // 1044
          return true;                                                                                 // 1045
        } catch (e) {                                                                                  // 1046
          // XXX make all compilation errors MinimongoError or something                               // 1047
          //     so that this doesn't ignore unrelated exceptions                                      // 1048
          return false;                                                                                // 1049
        }                                                                                              // 1050
      }, function () {                                                                                 // 1051
        // ... and the selector itself needs to support oplog.                                         // 1052
        return OplogObserveDriver.cursorSupported(cursorDescription, matcher);                         // 1053
      }, function () {                                                                                 // 1054
        // And we need to be able to compile the sort, if any.  eg, can't be                           // 1055
        // {$natural: 1}.                                                                              // 1056
        if (!cursorDescription.options.sort)                                                           // 1057
          return true;                                                                                 // 1058
        try {                                                                                          // 1059
          sorter = new Minimongo.Sorter(cursorDescription.options.sort,                                // 1060
                                        { matcher: matcher });                                         // 1061
          return true;                                                                                 // 1062
        } catch (e) {                                                                                  // 1063
          // XXX make all compilation errors MinimongoError or something                               // 1064
          //     so that this doesn't ignore unrelated exceptions                                      // 1065
          return false;                                                                                // 1066
        }                                                                                              // 1067
      }], function (f) { return f(); });  // invoke each function                                      // 1068
                                                                                                       // 1069
    var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;                         // 1070
    observeDriver = new driverClass({                                                                  // 1071
      cursorDescription: cursorDescription,                                                            // 1072
      mongoHandle: self,                                                                               // 1073
      multiplexer: multiplexer,                                                                        // 1074
      ordered: ordered,                                                                                // 1075
      matcher: matcher,  // ignored by polling                                                         // 1076
      sorter: sorter,  // ignored by polling                                                           // 1077
      _testOnlyPollCallback: callbacks._testOnlyPollCallback                                           // 1078
    });                                                                                                // 1079
                                                                                                       // 1080
    // This field is only set for use in tests.                                                        // 1081
    multiplexer._observeDriver = observeDriver;                                                        // 1082
  }                                                                                                    // 1083
                                                                                                       // 1084
  // Blocks until the initial adds have been sent.                                                     // 1085
  multiplexer.addHandleAndSendInitialAdds(observeHandle);                                              // 1086
                                                                                                       // 1087
  return observeHandle;                                                                                // 1088
};                                                                                                     // 1089
                                                                                                       // 1090
// Listen for the invalidation messages that will trigger us to poll the                               // 1091
// database for changes. If this selector specifies specific IDs, specify them                         // 1092
// here, so that updates to different specific IDs don't cause us to poll.                             // 1093
// listenCallback is the same kind of (notification, complete) callback passed                         // 1094
// to InvalidationCrossbar.listen.                                                                     // 1095
                                                                                                       // 1096
listenAll = function (cursorDescription, listenCallback) {                                             // 1097
  var listeners = [];                                                                                  // 1098
  forEachTrigger(cursorDescription, function (trigger) {                                               // 1099
    listeners.push(DDPServer._InvalidationCrossbar.listen(                                             // 1100
      trigger, listenCallback));                                                                       // 1101
  });                                                                                                  // 1102
                                                                                                       // 1103
  return {                                                                                             // 1104
    stop: function () {                                                                                // 1105
      _.each(listeners, function (listener) {                                                          // 1106
        listener.stop();                                                                               // 1107
      });                                                                                              // 1108
    }                                                                                                  // 1109
  };                                                                                                   // 1110
};                                                                                                     // 1111
                                                                                                       // 1112
forEachTrigger = function (cursorDescription, triggerCallback) {                                       // 1113
  var key = {collection: cursorDescription.collectionName};                                            // 1114
  var specificIds = LocalCollection._idsMatchedBySelector(                                             // 1115
    cursorDescription.selector);                                                                       // 1116
  if (specificIds) {                                                                                   // 1117
    _.each(specificIds, function (id) {                                                                // 1118
      triggerCallback(_.extend({id: id}, key));                                                        // 1119
    });                                                                                                // 1120
    triggerCallback(_.extend({dropCollection: true, id: null}, key));                                  // 1121
  } else {                                                                                             // 1122
    triggerCallback(key);                                                                              // 1123
  }                                                                                                    // 1124
};                                                                                                     // 1125
                                                                                                       // 1126
// observeChanges for tailable cursors on capped collections.                                          // 1127
//                                                                                                     // 1128
// Some differences from normal cursors:                                                               // 1129
//   - Will never produce anything other than 'added' or 'addedBefore'. If you                         // 1130
//     do update a document that has already been produced, this will not notice                       // 1131
//     it.                                                                                             // 1132
//   - If you disconnect and reconnect from Mongo, it will essentially restart                         // 1133
//     the query, which will lead to duplicate results. This is pretty bad,                            // 1134
//     but if you include a field called 'ts' which is inserted as                                     // 1135
//     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the                            // 1136
//     current Mongo-style timestamp), we'll be able to find the place to                              // 1137
//     restart properly. (This field is specifically understood by Mongo with an                       // 1138
//     optimization which allows it to find the right place to start without                           // 1139
//     an index on ts. It's how the oplog works.)                                                      // 1140
//   - No callbacks are triggered synchronously with the call (there's no                              // 1141
//     differentiation between "initial data" and "later changes"; everything                          // 1142
//     that matches the query gets sent asynchronously).                                               // 1143
//   - De-duplication is not implemented.                                                              // 1144
//   - Does not yet interact with the write fence. Probably, this should work by                       // 1145
//     ignoring removes (which don't work on capped collections) and updates                           // 1146
//     (which don't affect tailable cursors), and just keeping track of the ID                         // 1147
//     of the inserted object, and closing the write fence once you get to that                        // 1148
//     ID (or timestamp?).  This doesn't work well if the document doesn't match                       // 1149
//     the query, though.  On the other hand, the write fence can close                                // 1150
//     immediately if it does not match the query. So if we trust minimongo                            // 1151
//     enough to accurately evaluate the query against the write fence, we                             // 1152
//     should be able to do this...  Of course, minimongo doesn't even support                         // 1153
//     Mongo Timestamps yet.                                                                           // 1154
MongoConnection.prototype._observeChangesTailable = function (                                         // 1155
    cursorDescription, ordered, callbacks) {                                                           // 1156
  var self = this;                                                                                     // 1157
                                                                                                       // 1158
  // Tailable cursors only ever call added/addedBefore callbacks, so it's an                           // 1159
  // error if you didn't provide them.                                                                 // 1160
  if ((ordered && !callbacks.addedBefore) ||                                                           // 1161
      (!ordered && !callbacks.added)) {                                                                // 1162
    throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered")                          // 1163
                    + " tailable cursor without a "                                                    // 1164
                    + (ordered ? "addedBefore" : "added") + " callback");                              // 1165
  }                                                                                                    // 1166
                                                                                                       // 1167
  return self.tail(cursorDescription, function (doc) {                                                 // 1168
    var id = doc._id;                                                                                  // 1169
    delete doc._id;                                                                                    // 1170
    // The ts is an implementation detail. Hide it.                                                    // 1171
    delete doc.ts;                                                                                     // 1172
    if (ordered) {                                                                                     // 1173
      callbacks.addedBefore(id, doc, null);                                                            // 1174
    } else {                                                                                           // 1175
      callbacks.added(id, doc);                                                                        // 1176
    }                                                                                                  // 1177
  });                                                                                                  // 1178
};                                                                                                     // 1179
                                                                                                       // 1180
// XXX We probably need to find a better way to expose this. Right now                                 // 1181
// it's only used by tests, but in fact you need it in normal                                          // 1182
// operation to interact with capped collections (eg, Galaxy uses it).                                 // 1183
MongoInternals.MongoTimestamp = MongoDB.Timestamp;                                                     // 1184
                                                                                                       // 1185
MongoInternals.Connection = MongoConnection;                                                           // 1186
MongoInternals.NpmModule = MongoDB;                                                                    // 1187
                                                                                                       // 1188
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/oplog_tailing.js                                                            //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Future = Npm.require('fibers/future');                                                             // 1
                                                                                                       // 2
OPLOG_COLLECTION = 'oplog.rs';                                                                         // 3
var REPLSET_COLLECTION = 'system.replset';                                                             // 4
                                                                                                       // 5
// Like Perl's quotemeta: quotes all regexp metacharacters. See                                        // 6
//   https://github.com/substack/quotemeta/blob/master/index.js                                        // 7
// XXX this is duplicated with accounts_server.js                                                      // 8
var quotemeta = function (str) {                                                                       // 9
    return String(str).replace(/(\W)/g, '\\$1');                                                       // 10
};                                                                                                     // 11
                                                                                                       // 12
var showTS = function (ts) {                                                                           // 13
  return "Timestamp(" + ts.getHighBits() + ", " + ts.getLowBits() + ")";                               // 14
};                                                                                                     // 15
                                                                                                       // 16
idForOp = function (op) {                                                                              // 17
  if (op.op === 'd')                                                                                   // 18
    return op.o._id;                                                                                   // 19
  else if (op.op === 'i')                                                                              // 20
    return op.o._id;                                                                                   // 21
  else if (op.op === 'u')                                                                              // 22
    return op.o2._id;                                                                                  // 23
  else if (op.op === 'c')                                                                              // 24
    throw Error("Operator 'c' doesn't supply an object with id: " +                                    // 25
                EJSON.stringify(op));                                                                  // 26
  else                                                                                                 // 27
    throw Error("Unknown op: " + EJSON.stringify(op));                                                 // 28
};                                                                                                     // 29
                                                                                                       // 30
OplogHandle = function (oplogUrl, dbName) {                                                            // 31
  var self = this;                                                                                     // 32
  self._oplogUrl = oplogUrl;                                                                           // 33
  self._dbName = dbName;                                                                               // 34
                                                                                                       // 35
  self._oplogLastEntryConnection = null;                                                               // 36
  self._oplogTailConnection = null;                                                                    // 37
  self._stopped = false;                                                                               // 38
  self._tailHandle = null;                                                                             // 39
  self._readyFuture = new Future();                                                                    // 40
  self._crossbar = new DDPServer._Crossbar({                                                           // 41
    factPackage: "mongo-livedata", factName: "oplog-watchers"                                          // 42
  });                                                                                                  // 43
  self._lastProcessedTS = null;                                                                        // 44
  self._baseOplogSelector = {                                                                          // 45
    ns: new RegExp('^' + quotemeta(self._dbName) + '\\.'),                                             // 46
    $or: [                                                                                             // 47
      { op: {$in: ['i', 'u', 'd']} },                                                                  // 48
      // If it is not db.collection.drop(), ignore it                                                  // 49
      { op: 'c', 'o.drop': { $exists: true } }]                                                        // 50
  };                                                                                                   // 51
  // XXX doc                                                                                           // 52
  self._catchingUpFutures = [];                                                                        // 53
                                                                                                       // 54
  self._startTailing();                                                                                // 55
};                                                                                                     // 56
                                                                                                       // 57
_.extend(OplogHandle.prototype, {                                                                      // 58
  stop: function () {                                                                                  // 59
    var self = this;                                                                                   // 60
    if (self._stopped)                                                                                 // 61
      return;                                                                                          // 62
    self._stopped = true;                                                                              // 63
    if (self._tailHandle)                                                                              // 64
      self._tailHandle.stop();                                                                         // 65
    // XXX should close connections too                                                                // 66
  },                                                                                                   // 67
  onOplogEntry: function (trigger, callback) {                                                         // 68
    var self = this;                                                                                   // 69
    if (self._stopped)                                                                                 // 70
      throw new Error("Called onOplogEntry on stopped handle!");                                       // 71
                                                                                                       // 72
    // Calling onOplogEntry requires us to wait for the tailing to be ready.                           // 73
    self._readyFuture.wait();                                                                          // 74
                                                                                                       // 75
    var originalCallback = callback;                                                                   // 76
    callback = Meteor.bindEnvironment(function (notification) {                                        // 77
      // XXX can we avoid this clone by making oplog.js careful?                                       // 78
      originalCallback(EJSON.clone(notification));                                                     // 79
    }, function (err) {                                                                                // 80
      Meteor._debug("Error in oplog callback", err.stack);                                             // 81
    });                                                                                                // 82
    var listenHandle = self._crossbar.listen(trigger, callback);                                       // 83
    return {                                                                                           // 84
      stop: function () {                                                                              // 85
        listenHandle.stop();                                                                           // 86
      }                                                                                                // 87
    };                                                                                                 // 88
  },                                                                                                   // 89
  // Calls `callback` once the oplog has been processed up to a point that is                          // 90
  // roughly "now": specifically, once we've processed all ops that are                                // 91
  // currently visible.                                                                                // 92
  // XXX become convinced that this is actually safe even if oplogConnection                           // 93
  // is some kind of pool                                                                              // 94
  waitUntilCaughtUp: function () {                                                                     // 95
    var self = this;                                                                                   // 96
    if (self._stopped)                                                                                 // 97
      throw new Error("Called waitUntilCaughtUp on stopped handle!");                                  // 98
                                                                                                       // 99
    // Calling waitUntilCaughtUp requries us to wait for the oplog connection to                       // 100
    // be ready.                                                                                       // 101
    self._readyFuture.wait();                                                                          // 102
                                                                                                       // 103
    while (!self._stopped) {                                                                           // 104
      // We need to make the selector at least as restrictive as the actual                            // 105
      // tailing selector (ie, we need to specify the DB name) or else we might                        // 106
      // find a TS that won't show up in the actual tail stream.                                       // 107
      try {                                                                                            // 108
        var lastEntry = self._oplogLastEntryConnection.findOne(                                        // 109
          OPLOG_COLLECTION, self._baseOplogSelector,                                                   // 110
          {fields: {ts: 1}, sort: {$natural: -1}});                                                    // 111
        break;                                                                                         // 112
      } catch (e) {                                                                                    // 113
        // During failover (eg) if we get an exception we should log and retry                         // 114
        // instead of crashing.                                                                        // 115
        Meteor._debug("Got exception while reading last entry: " + e);                                 // 116
        Meteor._sleepForMs(100);                                                                       // 117
      }                                                                                                // 118
    }                                                                                                  // 119
                                                                                                       // 120
    if (self._stopped)                                                                                 // 121
      return;                                                                                          // 122
                                                                                                       // 123
    if (!lastEntry) {                                                                                  // 124
      // Really, nothing in the oplog? Well, we've processed everything.                               // 125
      return;                                                                                          // 126
    }                                                                                                  // 127
                                                                                                       // 128
    var ts = lastEntry.ts;                                                                             // 129
    if (!ts)                                                                                           // 130
      throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));                            // 131
                                                                                                       // 132
    if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {                          // 133
      // We've already caught up to here.                                                              // 134
      return;                                                                                          // 135
    }                                                                                                  // 136
                                                                                                       // 137
                                                                                                       // 138
    // Insert the future into our list. Almost always, this will be at the end,                        // 139
    // but it's conceivable that if we fail over from one primary to another,                          // 140
    // the oplog entries we see will go backwards.                                                     // 141
    var insertAfter = self._catchingUpFutures.length;                                                  // 142
    while (insertAfter - 1 > 0                                                                         // 143
           && self._catchingUpFutures[insertAfter - 1].ts.greaterThan(ts)) {                           // 144
      insertAfter--;                                                                                   // 145
    }                                                                                                  // 146
    var f = new Future;                                                                                // 147
    self._catchingUpFutures.splice(insertAfter, 0, {ts: ts, future: f});                               // 148
    f.wait();                                                                                          // 149
  },                                                                                                   // 150
  _startTailing: function () {                                                                         // 151
    var self = this;                                                                                   // 152
    // We make two separate connections to Mongo. The Node Mongo driver                                // 153
    // implements a naive round-robin connection pool: each "connection" is a                          // 154
    // pool of several (5 by default) TCP connections, and each request is                             // 155
    // rotated through the pools. Tailable cursor queries block on the server                          // 156
    // until there is some data to return (or until a few seconds have                                 // 157
    // passed). So if the connection pool used for tailing cursors is the same                         // 158
    // pool used for other queries, the other queries will be delayed by seconds                       // 159
    // 1/5 of the time.                                                                                // 160
    //                                                                                                 // 161
    // The tail connection will only ever be running a single tail command, so                         // 162
    // it only needs to make one underlying TCP connection.                                            // 163
    self._oplogTailConnection = new MongoConnection(                                                   // 164
      self._oplogUrl, {poolSize: 1});                                                                  // 165
    // XXX better docs, but: it's to get monotonic results                                             // 166
    // XXX is it safe to say "if there's an in flight query, just use its                              // 167
    //     results"? I don't think so but should consider that                                         // 168
    self._oplogLastEntryConnection = new MongoConnection(                                              // 169
      self._oplogUrl, {poolSize: 1});                                                                  // 170
                                                                                                       // 171
    // First, make sure that there actually is a repl set here. If not, oplog                          // 172
    // tailing won't ever find anything! (Blocks until the connection is ready.)                       // 173
    var replSetInfo = self._oplogLastEntryConnection.findOne(                                          // 174
      REPLSET_COLLECTION, {});                                                                         // 175
    if (!replSetInfo)                                                                                  // 176
      throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " +                         // 177
                  "a Mongo replica set");                                                              // 178
                                                                                                       // 179
    // Find the last oplog entry.                                                                      // 180
    var lastOplogEntry = self._oplogLastEntryConnection.findOne(                                       // 181
      OPLOG_COLLECTION, {}, {sort: {$natural: -1}, fields: {ts: 1}});                                  // 182
                                                                                                       // 183
    var oplogSelector = _.clone(self._baseOplogSelector);                                              // 184
    if (lastOplogEntry) {                                                                              // 185
      // Start after the last entry that currently exists.                                             // 186
      oplogSelector.ts = {$gt: lastOplogEntry.ts};                                                     // 187
      // If there are any calls to callWhenProcessedLatest before any other                            // 188
      // oplog entries show up, allow callWhenProcessedLatest to call its                              // 189
      // callback immediately.                                                                         // 190
      self._lastProcessedTS = lastOplogEntry.ts;                                                       // 191
    }                                                                                                  // 192
                                                                                                       // 193
    var cursorDescription = new CursorDescription(                                                     // 194
      OPLOG_COLLECTION, oplogSelector, {tailable: true});                                              // 195
                                                                                                       // 196
    self._tailHandle = self._oplogTailConnection.tail(                                                 // 197
      cursorDescription, function (doc) {                                                              // 198
        if (!(doc.ns && doc.ns.length > self._dbName.length + 1 &&                                     // 199
              doc.ns.substr(0, self._dbName.length + 1) ===                                            // 200
              (self._dbName + '.'))) {                                                                 // 201
          throw new Error("Unexpected ns");                                                            // 202
        }                                                                                              // 203
                                                                                                       // 204
        var trigger = {collection: doc.ns.substr(self._dbName.length + 1),                             // 205
                       dropCollection: false,                                                          // 206
                       op: doc};                                                                       // 207
                                                                                                       // 208
        // Is it a special command and the collection name is hidden somewhere                         // 209
        // in operator?                                                                                // 210
        if (trigger.collection === "$cmd") {                                                           // 211
          trigger.collection = doc.o.drop;                                                             // 212
          trigger.dropCollection = true;                                                               // 213
          trigger.id = null;                                                                           // 214
        } else {                                                                                       // 215
          // All other ops have an id.                                                                 // 216
          trigger.id = idForOp(doc);                                                                   // 217
        }                                                                                              // 218
                                                                                                       // 219
        self._crossbar.fire(trigger);                                                                  // 220
                                                                                                       // 221
        // Now that we've processed this operation, process pending sequencers.                        // 222
        if (!doc.ts)                                                                                   // 223
          throw Error("oplog entry without ts: " + EJSON.stringify(doc));                              // 224
        self._lastProcessedTS = doc.ts;                                                                // 225
        while (!_.isEmpty(self._catchingUpFutures)                                                     // 226
               && self._catchingUpFutures[0].ts.lessThanOrEqual(                                       // 227
                 self._lastProcessedTS)) {                                                             // 228
          var sequencer = self._catchingUpFutures.shift();                                             // 229
          sequencer.future.return();                                                                   // 230
        }                                                                                              // 231
      });                                                                                              // 232
    self._readyFuture.return();                                                                        // 233
  }                                                                                                    // 234
});                                                                                                    // 235
                                                                                                       // 236
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/observe_multiplex.js                                                        //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Future = Npm.require('fibers/future');                                                             // 1
                                                                                                       // 2
ObserveMultiplexer = function (options) {                                                              // 3
  var self = this;                                                                                     // 4
                                                                                                       // 5
  if (!options || !_.has(options, 'ordered'))                                                          // 6
    throw Error("must specified ordered");                                                             // 7
                                                                                                       // 8
  Package.facts && Package.facts.Facts.incrementServerFact(                                            // 9
    "mongo-livedata", "observe-multiplexers", 1);                                                      // 10
                                                                                                       // 11
  self._ordered = options.ordered;                                                                     // 12
  self._onStop = options.onStop || function () {};                                                     // 13
  self._queue = new Meteor._SynchronousQueue();                                                        // 14
  self._handles = {};                                                                                  // 15
  self._readyFuture = new Future;                                                                      // 16
  self._cache = new LocalCollection._CachingChangeObserver({                                           // 17
    ordered: options.ordered});                                                                        // 18
  // Number of addHandleAndSendInitialAdds tasks scheduled but not yet                                 // 19
  // running. removeHandle uses this to know if it's time to call the onStop                           // 20
  // callback.                                                                                         // 21
  self._addHandleTasksScheduledButNotPerformed = 0;                                                    // 22
                                                                                                       // 23
  _.each(self.callbackNames(), function (callbackName) {                                               // 24
    self[callbackName] = function (/* ... */) {                                                        // 25
      self._applyCallback(callbackName, _.toArray(arguments));                                         // 26
    };                                                                                                 // 27
  });                                                                                                  // 28
};                                                                                                     // 29
                                                                                                       // 30
_.extend(ObserveMultiplexer.prototype, {                                                               // 31
  addHandleAndSendInitialAdds: function (handle) {                                                     // 32
    var self = this;                                                                                   // 33
                                                                                                       // 34
    // Check this before calling runTask (even though runTask does the same                            // 35
    // check) so that we don't leak an ObserveMultiplexer on error by                                  // 36
    // incrementing _addHandleTasksScheduledButNotPerformed and never                                  // 37
    // decrementing it.                                                                                // 38
    if (!self._queue.safeToRunTask())                                                                  // 39
      throw new Error(                                                                                 // 40
        "Can't call observeChanges from an observe callback on the same query");                       // 41
    ++self._addHandleTasksScheduledButNotPerformed;                                                    // 42
                                                                                                       // 43
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 44
      "mongo-livedata", "observe-handles", 1);                                                         // 45
                                                                                                       // 46
    self._queue.runTask(function () {                                                                  // 47
      self._handles[handle._id] = handle;                                                              // 48
      // Send out whatever adds we have so far (whether or not we the                                  // 49
      // multiplexer is ready).                                                                        // 50
      self._sendAdds(handle);                                                                          // 51
      --self._addHandleTasksScheduledButNotPerformed;                                                  // 52
    });                                                                                                // 53
    // *outside* the task, since otherwise we'd deadlock                                               // 54
    self._readyFuture.wait();                                                                          // 55
  },                                                                                                   // 56
                                                                                                       // 57
  // Remove an observe handle. If it was the last observe handle, call the                             // 58
  // onStop callback; you cannot add any more observe handles after this.                              // 59
  //                                                                                                   // 60
  // This is not synchronized with polls and handle additions: this means that                         // 61
  // you can safely call it from within an observe callback, but it also means                         // 62
  // that we have to be careful when we iterate over _handles.                                         // 63
  removeHandle: function (id) {                                                                        // 64
    var self = this;                                                                                   // 65
                                                                                                       // 66
    // This should not be possible: you can only call removeHandle by having                           // 67
    // access to the ObserveHandle, which isn't returned to user code until the                        // 68
    // multiplex is ready.                                                                             // 69
    if (!self._ready())                                                                                // 70
      throw new Error("Can't remove handles until the multiplex is ready");                            // 71
                                                                                                       // 72
    delete self._handles[id];                                                                          // 73
                                                                                                       // 74
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 75
      "mongo-livedata", "observe-handles", -1);                                                        // 76
                                                                                                       // 77
    if (_.isEmpty(self._handles) &&                                                                    // 78
        self._addHandleTasksScheduledButNotPerformed === 0) {                                          // 79
      self._stop();                                                                                    // 80
    }                                                                                                  // 81
  },                                                                                                   // 82
  _stop: function () {                                                                                 // 83
    var self = this;                                                                                   // 84
    // It shouldn't be possible for us to stop when all our handles still                              // 85
    // haven't been returned from observeChanges!                                                      // 86
    if (!self._ready())                                                                                // 87
      throw Error("surprising _stop: not ready");                                                      // 88
                                                                                                       // 89
    // Call stop callback (which kills the underlying process which sends us                           // 90
    // callbacks and removes us from the connection's dictionary).                                     // 91
    self._onStop();                                                                                    // 92
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 93
      "mongo-livedata", "observe-multiplexers", -1);                                                   // 94
                                                                                                       // 95
    // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop                         // 96
    // callback should make our connection forget about us).                                           // 97
    self._handles = null;                                                                              // 98
  },                                                                                                   // 99
  // Allows all addHandleAndSendInitialAdds calls to return, once all preceding                        // 100
  // adds have been processed. Does not block.                                                         // 101
  ready: function () {                                                                                 // 102
    var self = this;                                                                                   // 103
    self._queue.queueTask(function () {                                                                // 104
      if (self._ready())                                                                               // 105
        throw Error("can't make ObserveMultiplex ready twice!");                                       // 106
      self._readyFuture.return();                                                                      // 107
    });                                                                                                // 108
  },                                                                                                   // 109
  // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"                         // 110
  // and observe callbacks which came before this call have been propagated to                         // 111
  // all handles. "ready" must have already been called on this multiplexer.                           // 112
  onFlush: function (cb) {                                                                             // 113
    var self = this;                                                                                   // 114
    self._queue.queueTask(function () {                                                                // 115
      if (!self._ready())                                                                              // 116
        throw Error("only call onFlush on a multiplexer that will be ready");                          // 117
      cb();                                                                                            // 118
    });                                                                                                // 119
  },                                                                                                   // 120
  callbackNames: function () {                                                                         // 121
    var self = this;                                                                                   // 122
    if (self._ordered)                                                                                 // 123
      return ["addedBefore", "changed", "movedBefore", "removed"];                                     // 124
    else                                                                                               // 125
      return ["added", "changed", "removed"];                                                          // 126
  },                                                                                                   // 127
  _ready: function () {                                                                                // 128
    return this._readyFuture.isResolved();                                                             // 129
  },                                                                                                   // 130
  _applyCallback: function (callbackName, args) {                                                      // 131
    var self = this;                                                                                   // 132
    self._queue.queueTask(function () {                                                                // 133
      // If we stopped in the meantime, do nothing.                                                    // 134
      if (!self._handles)                                                                              // 135
        return;                                                                                        // 136
                                                                                                       // 137
      // First, apply the change to the cache.                                                         // 138
      // XXX We could make applyChange callbacks promise not to hang on to any                         // 139
      // state from their arguments (assuming that their supplied callbacks                            // 140
      // don't) and skip this clone. Currently 'changed' hangs on to state                             // 141
      // though.                                                                                       // 142
      self._cache.applyChange[callbackName].apply(null, EJSON.clone(args));                            // 143
                                                                                                       // 144
      // If we haven't finished the initial adds, then we should only be getting                       // 145
      // adds.                                                                                         // 146
      if (!self._ready() &&                                                                            // 147
          (callbackName !== 'added' && callbackName !== 'addedBefore')) {                              // 148
        throw new Error("Got " + callbackName + " during initial adds");                               // 149
      }                                                                                                // 150
                                                                                                       // 151
      // Now multiplex the callbacks out to all observe handles. It's OK if                            // 152
      // these calls yield; since we're inside a task, no other use of our queue                       // 153
      // can continue until these are done. (But we do have to be careful to not                       // 154
      // use a handle that got removed, because removeHandle does not use the                          // 155
      // queue; thus, we iterate over an array of keys that we control.)                               // 156
      _.each(_.keys(self._handles), function (handleId) {                                              // 157
        var handle = self._handles && self._handles[handleId];                                         // 158
        if (!handle)                                                                                   // 159
          return;                                                                                      // 160
        var callback = handle['_' + callbackName];                                                     // 161
        // clone arguments so that callbacks can mutate their arguments                                // 162
        callback && callback.apply(null, EJSON.clone(args));                                           // 163
      });                                                                                              // 164
    });                                                                                                // 165
  },                                                                                                   // 166
                                                                                                       // 167
  // Sends initial adds to a handle. It should only be called from within a task                       // 168
  // (the task that is processing the addHandleAndSendInitialAdds call). It                            // 169
  // synchronously invokes the handle's added or addedBefore; there's no need to                       // 170
  // flush the queue afterwards to ensure that the callbacks get out.                                  // 171
  _sendAdds: function (handle) {                                                                       // 172
    var self = this;                                                                                   // 173
    if (self._queue.safeToRunTask())                                                                   // 174
      throw Error("_sendAdds may only be called from within a task!");                                 // 175
    var add = self._ordered ? handle._addedBefore : handle._added;                                     // 176
    if (!add)                                                                                          // 177
      return;                                                                                          // 178
    // note: docs may be an _IdMap or an OrderedDict                                                   // 179
    self._cache.docs.forEach(function (doc, id) {                                                      // 180
      if (!_.has(self._handles, handle._id))                                                           // 181
        throw Error("handle got removed before sending initial adds!");                                // 182
      var fields = EJSON.clone(doc);                                                                   // 183
      delete fields._id;                                                                               // 184
      if (self._ordered)                                                                               // 185
        add(id, fields, null); // we're going in order, so add at end                                  // 186
      else                                                                                             // 187
        add(id, fields);                                                                               // 188
    });                                                                                                // 189
  }                                                                                                    // 190
});                                                                                                    // 191
                                                                                                       // 192
                                                                                                       // 193
var nextObserveHandleId = 1;                                                                           // 194
ObserveHandle = function (multiplexer, callbacks) {                                                    // 195
  var self = this;                                                                                     // 196
  // The end user is only supposed to call stop().  The other fields are                               // 197
  // accessible to the multiplexer, though.                                                            // 198
  self._multiplexer = multiplexer;                                                                     // 199
  _.each(multiplexer.callbackNames(), function (name) {                                                // 200
    if (callbacks[name]) {                                                                             // 201
      self['_' + name] = callbacks[name];                                                              // 202
    } else if (name === "addedBefore" && callbacks.added) {                                            // 203
      // Special case: if you specify "added" and "movedBefore", you get an                            // 204
      // ordered observe where for some reason you don't get ordering data on                          // 205
      // the adds.  I dunno, we wrote tests for it, there must have been a                             // 206
      // reason.                                                                                       // 207
      self._addedBefore = function (id, fields, before) {                                              // 208
        callbacks.added(id, fields);                                                                   // 209
      };                                                                                               // 210
    }                                                                                                  // 211
  });                                                                                                  // 212
  self._stopped = false;                                                                               // 213
  self._id = nextObserveHandleId++;                                                                    // 214
};                                                                                                     // 215
ObserveHandle.prototype.stop = function () {                                                           // 216
  var self = this;                                                                                     // 217
  if (self._stopped)                                                                                   // 218
    return;                                                                                            // 219
  self._stopped = true;                                                                                // 220
  self._multiplexer.removeHandle(self._id);                                                            // 221
};                                                                                                     // 222
                                                                                                       // 223
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/doc_fetcher.js                                                              //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Fiber = Npm.require('fibers');                                                                     // 1
var Future = Npm.require('fibers/future');                                                             // 2
                                                                                                       // 3
DocFetcher = function (mongoConnection) {                                                              // 4
  var self = this;                                                                                     // 5
  self._mongoConnection = mongoConnection;                                                             // 6
  // Map from cache key -> [callback]                                                                  // 7
  self._callbacksForCacheKey = {};                                                                     // 8
};                                                                                                     // 9
                                                                                                       // 10
_.extend(DocFetcher.prototype, {                                                                       // 11
  // Fetches document "id" from collectionName, returning it or null if not                            // 12
  // found.                                                                                            // 13
  //                                                                                                   // 14
  // If you make multiple calls to fetch() with the same cacheKey (a string),                          // 15
  // DocFetcher may assume that they all return the same document. (It does                            // 16
  // not check to see if collectionName/id match.)                                                     // 17
  //                                                                                                   // 18
  // You may assume that callback is never called synchronously (and in fact                           // 19
  // OplogObserveDriver does so).                                                                      // 20
  fetch: function (collectionName, id, cacheKey, callback) {                                           // 21
    var self = this;                                                                                   // 22
                                                                                                       // 23
    check(collectionName, String);                                                                     // 24
    // id is some sort of scalar                                                                       // 25
    check(cacheKey, String);                                                                           // 26
                                                                                                       // 27
    // If there's already an in-progress fetch for this cache key, yield until                         // 28
    // it's done and return whatever it returns.                                                       // 29
    if (_.has(self._callbacksForCacheKey, cacheKey)) {                                                 // 30
      self._callbacksForCacheKey[cacheKey].push(callback);                                             // 31
      return;                                                                                          // 32
    }                                                                                                  // 33
                                                                                                       // 34
    var callbacks = self._callbacksForCacheKey[cacheKey] = [callback];                                 // 35
                                                                                                       // 36
    Fiber(function () {                                                                                // 37
      try {                                                                                            // 38
        var doc = self._mongoConnection.findOne(                                                       // 39
          collectionName, {_id: id}) || null;                                                          // 40
        // Return doc to all relevant callbacks. Note that this array can                              // 41
        // continue to grow during callback excecution.                                                // 42
        while (!_.isEmpty(callbacks)) {                                                                // 43
          // Clone the document so that the various calls to fetch don't return                        // 44
          // objects that are intertwingled with each other. Clone before                              // 45
          // popping the future, so that if clone throws, the error gets passed                        // 46
          // to the next callback.                                                                     // 47
          var clonedDoc = EJSON.clone(doc);                                                            // 48
          callbacks.pop()(null, clonedDoc);                                                            // 49
        }                                                                                              // 50
      } catch (e) {                                                                                    // 51
        while (!_.isEmpty(callbacks)) {                                                                // 52
          callbacks.pop()(e);                                                                          // 53
        }                                                                                              // 54
      } finally {                                                                                      // 55
        // XXX consider keeping the doc around for a period of time before                             // 56
        // removing from the cache                                                                     // 57
        delete self._callbacksForCacheKey[cacheKey];                                                   // 58
      }                                                                                                // 59
    }).run();                                                                                          // 60
  }                                                                                                    // 61
});                                                                                                    // 62
                                                                                                       // 63
MongoTest.DocFetcher = DocFetcher;                                                                     // 64
                                                                                                       // 65
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/polling_observe_driver.js                                                   //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
PollingObserveDriver = function (options) {                                                            // 1
  var self = this;                                                                                     // 2
                                                                                                       // 3
  self._cursorDescription = options.cursorDescription;                                                 // 4
  self._mongoHandle = options.mongoHandle;                                                             // 5
  self._ordered = options.ordered;                                                                     // 6
  self._multiplexer = options.multiplexer;                                                             // 7
  self._stopCallbacks = [];                                                                            // 8
  self._stopped = false;                                                                               // 9
                                                                                                       // 10
  self._synchronousCursor = self._mongoHandle._createSynchronousCursor(                                // 11
    self._cursorDescription);                                                                          // 12
                                                                                                       // 13
  // previous results snapshot.  on each poll cycle, diffs against                                     // 14
  // results drives the callbacks.                                                                     // 15
  self._results = null;                                                                                // 16
                                                                                                       // 17
  // The number of _pollMongo calls that have been added to self._taskQueue but                        // 18
  // have not started running. Used to make sure we never schedule more than one                       // 19
  // _pollMongo (other than possibly the one that is currently running). It's                          // 20
  // also used by _suspendPolling to pretend there's a poll scheduled. Usually,                        // 21
  // it's either 0 (for "no polls scheduled other than maybe one currently                             // 22
  // running") or 1 (for "a poll scheduled that isn't running yet"), but it can                        // 23
  // also be 2 if incremented by _suspendPolling.                                                      // 24
  self._pollsScheduledButNotStarted = 0;                                                               // 25
  self._pendingWrites = []; // people to notify when polling completes                                 // 26
                                                                                                       // 27
  // Make sure to create a separately throttled function for each                                      // 28
  // PollingObserveDriver object.                                                                      // 29
  self._ensurePollIsScheduled = _.throttle(                                                            // 30
    self._unthrottledEnsurePollIsScheduled, 50 /* ms */);                                              // 31
                                                                                                       // 32
  // XXX figure out if we still need a queue                                                           // 33
  self._taskQueue = new Meteor._SynchronousQueue();                                                    // 34
                                                                                                       // 35
  var listenersHandle = listenAll(                                                                     // 36
    self._cursorDescription, function (notification) {                                                 // 37
      // When someone does a transaction that might affect us, schedule a poll                         // 38
      // of the database. If that transaction happens inside of a write fence,                         // 39
      // block the fence until we've polled and notified observers.                                    // 40
      var fence = DDPServer._CurrentWriteFence.get();                                                  // 41
      if (fence)                                                                                       // 42
        self._pendingWrites.push(fence.beginWrite());                                                  // 43
      // Ensure a poll is scheduled... but if we already know that one is,                             // 44
      // don't hit the throttled _ensurePollIsScheduled function (which might                          // 45
      // lead to us calling it unnecessarily in 50ms).                                                 // 46
      if (self._pollsScheduledButNotStarted === 0)                                                     // 47
        self._ensurePollIsScheduled();                                                                 // 48
    }                                                                                                  // 49
  );                                                                                                   // 50
  self._stopCallbacks.push(function () { listenersHandle.stop(); });                                   // 51
                                                                                                       // 52
  // every once and a while, poll even if we don't think we're dirty, for                              // 53
  // eventual consistency with database writes from outside the Meteor                                 // 54
  // universe.                                                                                         // 55
  //                                                                                                   // 56
  // For testing, there's an undocumented callback argument to observeChanges                          // 57
  // which disables time-based polling and gets called at the beginning of each                        // 58
  // poll.                                                                                             // 59
  if (options._testOnlyPollCallback) {                                                                 // 60
    self._testOnlyPollCallback = options._testOnlyPollCallback;                                        // 61
  } else {                                                                                             // 62
    var intervalHandle = Meteor.setInterval(                                                           // 63
      _.bind(self._ensurePollIsScheduled, self), 10 * 1000);                                           // 64
    self._stopCallbacks.push(function () {                                                             // 65
      Meteor.clearInterval(intervalHandle);                                                            // 66
    });                                                                                                // 67
  }                                                                                                    // 68
                                                                                                       // 69
  // Make sure we actually poll soon!                                                                  // 70
  self._unthrottledEnsurePollIsScheduled();                                                            // 71
                                                                                                       // 72
  Package.facts && Package.facts.Facts.incrementServerFact(                                            // 73
    "mongo-livedata", "observe-drivers-polling", 1);                                                   // 74
};                                                                                                     // 75
                                                                                                       // 76
_.extend(PollingObserveDriver.prototype, {                                                             // 77
  // This is always called through _.throttle (except once at startup).                                // 78
  _unthrottledEnsurePollIsScheduled: function () {                                                     // 79
    var self = this;                                                                                   // 80
    if (self._pollsScheduledButNotStarted > 0)                                                         // 81
      return;                                                                                          // 82
    ++self._pollsScheduledButNotStarted;                                                               // 83
    self._taskQueue.queueTask(function () {                                                            // 84
      self._pollMongo();                                                                               // 85
    });                                                                                                // 86
  },                                                                                                   // 87
                                                                                                       // 88
  // test-only interface for controlling polling.                                                      // 89
  //                                                                                                   // 90
  // _suspendPolling blocks until any currently running and scheduled polls are                        // 91
  // done, and prevents any further polls from being scheduled. (new                                   // 92
  // ObserveHandles can be added and receive their initial added callbacks,                            // 93
  // though.)                                                                                          // 94
  //                                                                                                   // 95
  // _resumePolling immediately polls, and allows further polls to occur.                              // 96
  _suspendPolling: function() {                                                                        // 97
    var self = this;                                                                                   // 98
    // Pretend that there's another poll scheduled (which will prevent                                 // 99
    // _ensurePollIsScheduled from queueing any more polls).                                           // 100
    ++self._pollsScheduledButNotStarted;                                                               // 101
    // Now block until all currently running or scheduled polls are done.                              // 102
    self._taskQueue.runTask(function() {});                                                            // 103
                                                                                                       // 104
    // Confirm that there is only one "poll" (the fake one we're pretending to                         // 105
    // have) scheduled.                                                                                // 106
    if (self._pollsScheduledButNotStarted !== 1)                                                       // 107
      throw new Error("_pollsScheduledButNotStarted is " +                                             // 108
                      self._pollsScheduledButNotStarted);                                              // 109
  },                                                                                                   // 110
  _resumePolling: function() {                                                                         // 111
    var self = this;                                                                                   // 112
    // We should be in the same state as in the end of _suspendPolling.                                // 113
    if (self._pollsScheduledButNotStarted !== 1)                                                       // 114
      throw new Error("_pollsScheduledButNotStarted is " +                                             // 115
                      self._pollsScheduledButNotStarted);                                              // 116
    // Run a poll synchronously (which will counteract the                                             // 117
    // ++_pollsScheduledButNotStarted from _suspendPolling).                                           // 118
    self._taskQueue.runTask(function () {                                                              // 119
      self._pollMongo();                                                                               // 120
    });                                                                                                // 121
  },                                                                                                   // 122
                                                                                                       // 123
  _pollMongo: function () {                                                                            // 124
    var self = this;                                                                                   // 125
    --self._pollsScheduledButNotStarted;                                                               // 126
                                                                                                       // 127
    var first = false;                                                                                 // 128
    if (!self._results) {                                                                              // 129
      first = true;                                                                                    // 130
      // XXX maybe use OrderedDict instead?                                                            // 131
      self._results = self._ordered ? [] : new LocalCollection._IdMap;                                 // 132
    }                                                                                                  // 133
                                                                                                       // 134
    self._testOnlyPollCallback && self._testOnlyPollCallback();                                        // 135
                                                                                                       // 136
    // Save the list of pending writes which this round will commit.                                   // 137
    var writesForCycle = self._pendingWrites;                                                          // 138
    self._pendingWrites = [];                                                                          // 139
                                                                                                       // 140
    // Get the new query results. (These calls can yield.)                                             // 141
    if (!first)                                                                                        // 142
      self._synchronousCursor.rewind();                                                                // 143
    var newResults = self._synchronousCursor.getRawObjects(self._ordered);                             // 144
    var oldResults = self._results;                                                                    // 145
                                                                                                       // 146
    // Run diffs. (This can yield too.)                                                                // 147
    if (!self._stopped) {                                                                              // 148
      LocalCollection._diffQueryChanges(                                                               // 149
        self._ordered, oldResults, newResults, self._multiplexer);                                     // 150
    }                                                                                                  // 151
                                                                                                       // 152
    // Replace self._results atomically.                                                               // 153
    self._results = newResults;                                                                        // 154
                                                                                                       // 155
    // Signals the multiplexer to call all initial adds.                                               // 156
    if (first)                                                                                         // 157
      self._multiplexer.ready();                                                                       // 158
                                                                                                       // 159
    // Once the ObserveMultiplexer has processed everything we've done in this                         // 160
    // round, mark all the writes which existed before this call as                                    // 161
    // commmitted. (If new writes have shown up in the meantime, there'll                              // 162
    // already be another _pollMongo task scheduled.)                                                  // 163
    self._multiplexer.onFlush(function () {                                                            // 164
      _.each(writesForCycle, function (w) {                                                            // 165
        w.committed();                                                                                 // 166
      });                                                                                              // 167
    });                                                                                                // 168
  },                                                                                                   // 169
                                                                                                       // 170
  stop: function () {                                                                                  // 171
    var self = this;                                                                                   // 172
    self._stopped = true;                                                                              // 173
    _.each(self._stopCallbacks, function (c) { c(); });                                                // 174
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 175
      "mongo-livedata", "observe-drivers-polling", -1);                                                // 176
  }                                                                                                    // 177
});                                                                                                    // 178
                                                                                                       // 179
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/oplog_observe_driver.js                                                     //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Fiber = Npm.require('fibers');                                                                     // 1
var Future = Npm.require('fibers/future');                                                             // 2
                                                                                                       // 3
var PHASE = {                                                                                          // 4
  QUERYING: "QUERYING",                                                                                // 5
  FETCHING: "FETCHING",                                                                                // 6
  STEADY: "STEADY"                                                                                     // 7
};                                                                                                     // 8
                                                                                                       // 9
// Exception thrown by _needToPollQuery which unrolls the stack up to the                              // 10
// enclosing call to finishIfNeedToPollQuery.                                                          // 11
var SwitchedToQuery = function () {};                                                                  // 12
var finishIfNeedToPollQuery = function (f) {                                                           // 13
  return function () {                                                                                 // 14
    try {                                                                                              // 15
      f.apply(this, arguments);                                                                        // 16
    } catch (e) {                                                                                      // 17
      if (!(e instanceof SwitchedToQuery))                                                             // 18
        throw e;                                                                                       // 19
    }                                                                                                  // 20
  };                                                                                                   // 21
};                                                                                                     // 22
                                                                                                       // 23
// OplogObserveDriver is an alternative to PollingObserveDriver which follows                          // 24
// the Mongo operation log instead of just re-polling the query. It obeys the                          // 25
// same simple interface: constructing it starts sending observeChanges                                // 26
// callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop                        // 27
// it by calling the stop() method.                                                                    // 28
OplogObserveDriver = function (options) {                                                              // 29
  var self = this;                                                                                     // 30
  self._usesOplog = true;  // tests look at this                                                       // 31
                                                                                                       // 32
  self._cursorDescription = options.cursorDescription;                                                 // 33
  self._mongoHandle = options.mongoHandle;                                                             // 34
  self._multiplexer = options.multiplexer;                                                             // 35
                                                                                                       // 36
  if (options.ordered) {                                                                               // 37
    throw Error("OplogObserveDriver only supports unordered observeChanges");                          // 38
  }                                                                                                    // 39
                                                                                                       // 40
  var sorter = options.sorter;                                                                         // 41
  // We don't support $near and other geo-queries so it's OK to initialize the                         // 42
  // comparator only once in the constructor.                                                          // 43
  var comparator = sorter && sorter.getComparator();                                                   // 44
                                                                                                       // 45
  if (options.cursorDescription.options.limit) {                                                       // 46
    // There are several properties ordered driver implements:                                         // 47
    // - _limit is a positive number                                                                   // 48
    // - _comparator is a function-comparator by which the query is ordered                            // 49
    // - _unpublishedBuffer is non-null Min/Max Heap,                                                  // 50
    //                      the empty buffer in STEADY phase implies that the                          // 51
    //                      everything that matches the queries selector fits                          // 52
    //                      into published set.                                                        // 53
    // - _published - Min Heap (also implements IdMap methods)                                         // 54
                                                                                                       // 55
    var heapOptions = { IdMap: LocalCollection._IdMap };                                               // 56
    self._limit = self._cursorDescription.options.limit;                                               // 57
    self._comparator = comparator;                                                                     // 58
    self._sorter = sorter;                                                                             // 59
    self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);                                 // 60
    // We need something that can find Max value in addition to IdMap interface                        // 61
    self._published = new MaxHeap(comparator, heapOptions);                                            // 62
  } else {                                                                                             // 63
    self._limit = 0;                                                                                   // 64
    self._comparator = null;                                                                           // 65
    self._sorter = null;                                                                               // 66
    self._unpublishedBuffer = null;                                                                    // 67
    self._published = new LocalCollection._IdMap;                                                      // 68
  }                                                                                                    // 69
                                                                                                       // 70
  // Indicates if it is safe to insert a new document at the end of the buffer                         // 71
  // for this query. i.e. it is known that there are no documents matching the                         // 72
  // selector those are not in published or buffer.                                                    // 73
  self._safeAppendToBuffer = false;                                                                    // 74
                                                                                                       // 75
  self._stopped = false;                                                                               // 76
  self._stopHandles = [];                                                                              // 77
                                                                                                       // 78
  Package.facts && Package.facts.Facts.incrementServerFact(                                            // 79
    "mongo-livedata", "observe-drivers-oplog", 1);                                                     // 80
                                                                                                       // 81
  self._registerPhaseChange(PHASE.QUERYING);                                                           // 82
                                                                                                       // 83
  var selector = self._cursorDescription.selector;                                                     // 84
  self._matcher = options.matcher;                                                                     // 85
  var projection = self._cursorDescription.options.fields || {};                                       // 86
  self._projectionFn = LocalCollection._compileProjection(projection);                                 // 87
  // Projection function, result of combining important fields for selector and                        // 88
  // existing fields projection                                                                        // 89
  self._sharedProjection = self._matcher.combineIntoProjection(projection);                            // 90
  if (sorter)                                                                                          // 91
    self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);                     // 92
  self._sharedProjectionFn = LocalCollection._compileProjection(                                       // 93
    self._sharedProjection);                                                                           // 94
                                                                                                       // 95
  self._needToFetch = new LocalCollection._IdMap;                                                      // 96
  self._currentlyFetching = null;                                                                      // 97
  self._fetchGeneration = 0;                                                                           // 98
                                                                                                       // 99
  self._requeryWhenDoneThisQuery = false;                                                              // 100
  self._writesToCommitWhenWeReachSteady = [];                                                          // 101
                                                                                                       // 102
  forEachTrigger(self._cursorDescription, function (trigger) {                                         // 103
    self._stopHandles.push(self._mongoHandle._oplogHandle.onOplogEntry(                                // 104
      trigger, function (notification) {                                                               // 105
        Meteor._noYieldsAllowed(finishIfNeedToPollQuery(function () {                                  // 106
          var op = notification.op;                                                                    // 107
          if (notification.dropCollection) {                                                           // 108
            // Note: this call is not allowed to block on anything (especially                         // 109
            // on waiting for oplog entries to catch up) because that will block                       // 110
            // onOplogEntry!                                                                           // 111
            self._needToPollQuery();                                                                   // 112
          } else {                                                                                     // 113
            // All other operators should be handled depending on phase                                // 114
            if (self._phase === PHASE.QUERYING)                                                        // 115
              self._handleOplogEntryQuerying(op);                                                      // 116
            else                                                                                       // 117
              self._handleOplogEntrySteadyOrFetching(op);                                              // 118
          }                                                                                            // 119
        }));                                                                                           // 120
      }                                                                                                // 121
    ));                                                                                                // 122
  });                                                                                                  // 123
                                                                                                       // 124
  // XXX ordering w.r.t. everything else?                                                              // 125
  self._stopHandles.push(listenAll(                                                                    // 126
    self._cursorDescription, function (notification) {                                                 // 127
      // If we're not in a write fence, we don't have to do anything.                                  // 128
      var fence = DDPServer._CurrentWriteFence.get();                                                  // 129
      if (!fence)                                                                                      // 130
        return;                                                                                        // 131
      var write = fence.beginWrite();                                                                  // 132
      // This write cannot complete until we've caught up to "this point" in the                       // 133
      // oplog, and then made it back to the steady state.                                             // 134
      Meteor.defer(function () {                                                                       // 135
        self._mongoHandle._oplogHandle.waitUntilCaughtUp();                                            // 136
        if (self._stopped) {                                                                           // 137
          // We're stopped, so just immediately commit.                                                // 138
          write.committed();                                                                           // 139
        } else if (self._phase === PHASE.STEADY) {                                                     // 140
          // Make sure that all of the callbacks have made it through the                              // 141
          // multiplexer and been delivered to ObserveHandles before committing                        // 142
          // writes.                                                                                   // 143
          self._multiplexer.onFlush(function () {                                                      // 144
            write.committed();                                                                         // 145
          });                                                                                          // 146
        } else {                                                                                       // 147
          self._writesToCommitWhenWeReachSteady.push(write);                                           // 148
        }                                                                                              // 149
      });                                                                                              // 150
    }                                                                                                  // 151
  ));                                                                                                  // 152
                                                                                                       // 153
  // When Mongo fails over, we need to repoll the query, in case we processed an                       // 154
  // oplog entry that got rolled back.                                                                 // 155
  self._stopHandles.push(self._mongoHandle._onFailover(finishIfNeedToPollQuery(                        // 156
    function () {                                                                                      // 157
      self._needToPollQuery();                                                                         // 158
    })));                                                                                              // 159
                                                                                                       // 160
  // Give _observeChanges a chance to add the new ObserveHandle to our                                 // 161
  // multiplexer, so that the added calls get streamed.                                                // 162
  Meteor.defer(finishIfNeedToPollQuery(function () {                                                   // 163
    self._runInitialQuery();                                                                           // 164
  }));                                                                                                 // 165
};                                                                                                     // 166
                                                                                                       // 167
_.extend(OplogObserveDriver.prototype, {                                                               // 168
  _addPublished: function (id, doc) {                                                                  // 169
    var self = this;                                                                                   // 170
    var fields = _.clone(doc);                                                                         // 171
    delete fields._id;                                                                                 // 172
    self._published.set(id, self._sharedProjectionFn(doc));                                            // 173
    self._multiplexer.added(id, self._projectionFn(fields));                                           // 174
                                                                                                       // 175
    // After adding this document, the published set might be overflowed                               // 176
    // (exceeding capacity specified by limit). If so, push the maximum element                        // 177
    // to the buffer, we might want to save it in memory to reduce the amount of                       // 178
    // Mongo lookups in the future.                                                                    // 179
    if (self._limit && self._published.size() > self._limit) {                                         // 180
      // XXX in theory the size of published is no more than limit+1                                   // 181
      if (self._published.size() !== self._limit + 1) {                                                // 182
        throw new Error("After adding to published, " +                                                // 183
                        (self._published.size() - self._limit) +                                       // 184
                        " documents are overflowing the set");                                         // 185
      }                                                                                                // 186
                                                                                                       // 187
      var overflowingDocId = self._published.maxElementId();                                           // 188
      var overflowingDoc = self._published.get(overflowingDocId);                                      // 189
                                                                                                       // 190
      if (EJSON.equals(overflowingDocId, id)) {                                                        // 191
        throw new Error("The document just added is overflowing the published set");                   // 192
      }                                                                                                // 193
                                                                                                       // 194
      self._published.remove(overflowingDocId);                                                        // 195
      self._multiplexer.removed(overflowingDocId);                                                     // 196
      self._addBuffered(overflowingDocId, overflowingDoc);                                             // 197
    }                                                                                                  // 198
  },                                                                                                   // 199
  _removePublished: function (id) {                                                                    // 200
    var self = this;                                                                                   // 201
    self._published.remove(id);                                                                        // 202
    self._multiplexer.removed(id);                                                                     // 203
    if (! self._limit || self._published.size() === self._limit)                                       // 204
      return;                                                                                          // 205
                                                                                                       // 206
    if (self._published.size() > self._limit)                                                          // 207
      throw Error("self._published got too big");                                                      // 208
                                                                                                       // 209
    // OK, we are publishing less than the limit. Maybe we should look in the                          // 210
    // buffer to find the next element past what we were publishing before.                            // 211
                                                                                                       // 212
    if (!self._unpublishedBuffer.empty()) {                                                            // 213
      // There's something in the buffer; move the first thing in it to                                // 214
      // _published.                                                                                   // 215
      var newDocId = self._unpublishedBuffer.minElementId();                                           // 216
      var newDoc = self._unpublishedBuffer.get(newDocId);                                              // 217
      self._removeBuffered(newDocId);                                                                  // 218
      self._addPublished(newDocId, newDoc);                                                            // 219
      return;                                                                                          // 220
    }                                                                                                  // 221
                                                                                                       // 222
    // There's nothing in the buffer.  This could mean one of a few things.                            // 223
                                                                                                       // 224
    // (a) We could be in the middle of re-running the query (specifically, we                         // 225
    // could be in _publishNewResults). In that case, _unpublishedBuffer is                            // 226
    // empty because we clear it at the beginning of _publishNewResults. In this                       // 227
    // case, our caller already knows the entire answer to the query and we                            // 228
    // don't need to do anything fancy here.  Just return.                                             // 229
    if (self._phase === PHASE.QUERYING)                                                                // 230
      return;                                                                                          // 231
                                                                                                       // 232
    // (b) We're pretty confident that the union of _published and                                     // 233
    // _unpublishedBuffer contain all documents that match selector. Because                           // 234
    // _unpublishedBuffer is empty, that means we're confident that _published                         // 235
    // contains all documents that match selector. So we have nothing to do.                           // 236
    if (self._safeAppendToBuffer)                                                                      // 237
      return;                                                                                          // 238
                                                                                                       // 239
    // (c) Maybe there are other documents out there that should be in our                             // 240
    // buffer. But in that case, when we emptied _unpublishedBuffer in                                 // 241
    // _removeBuffered, we should have called _needToPollQuery, which will                             // 242
    // either put something in _unpublishedBuffer or set _safeAppendToBuffer (or                       // 243
    // both), and it will put us in QUERYING for that whole time. So in fact, we                       // 244
    // shouldn't be able to get here.                                                                  // 245
                                                                                                       // 246
    throw new Error("Buffer inexplicably empty");                                                      // 247
  },                                                                                                   // 248
  _changePublished: function (id, oldDoc, newDoc) {                                                    // 249
    var self = this;                                                                                   // 250
    self._published.set(id, self._sharedProjectionFn(newDoc));                                         // 251
    var changed = LocalCollection._makeChangedFields(_.clone(newDoc), oldDoc);                         // 252
    changed = self._projectionFn(changed);                                                             // 253
    if (!_.isEmpty(changed))                                                                           // 254
      self._multiplexer.changed(id, changed);                                                          // 255
  },                                                                                                   // 256
  _addBuffered: function (id, doc) {                                                                   // 257
    var self = this;                                                                                   // 258
    self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));                                    // 259
                                                                                                       // 260
    // If something is overflowing the buffer, we just remove it from cache                            // 261
    if (self._unpublishedBuffer.size() > self._limit) {                                                // 262
      var maxBufferedId = self._unpublishedBuffer.maxElementId();                                      // 263
                                                                                                       // 264
      self._unpublishedBuffer.remove(maxBufferedId);                                                   // 265
                                                                                                       // 266
      // Since something matching is removed from cache (both published set and                        // 267
      // buffer), set flag to false                                                                    // 268
      self._safeAppendToBuffer = false;                                                                // 269
    }                                                                                                  // 270
  },                                                                                                   // 271
  // Is called either to remove the doc completely from matching set or to move                        // 272
  // it to the published set later.                                                                    // 273
  _removeBuffered: function (id) {                                                                     // 274
    var self = this;                                                                                   // 275
    self._unpublishedBuffer.remove(id);                                                                // 276
    // To keep the contract "buffer is never empty in STEADY phase unless the                          // 277
    // everything matching fits into published" true, we poll everything as soon                       // 278
    // as we see the buffer becoming empty.                                                            // 279
    if (! self._unpublishedBuffer.size() && ! self._safeAppendToBuffer)                                // 280
      self._needToPollQuery();                                                                         // 281
  },                                                                                                   // 282
  // Called when a document has joined the "Matching" results set.                                     // 283
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published                        // 284
  // and the effect of limit enforced.                                                                 // 285
  _addMatching: function (doc) {                                                                       // 286
    var self = this;                                                                                   // 287
    var id = doc._id;                                                                                  // 288
    if (self._published.has(id))                                                                       // 289
      throw Error("tried to add something already published " + id);                                   // 290
    if (self._limit && self._unpublishedBuffer.has(id))                                                // 291
      throw Error("tried to add something already existed in buffer " + id);                           // 292
                                                                                                       // 293
    var limit = self._limit;                                                                           // 294
    var comparator = self._comparator;                                                                 // 295
    var maxPublished = (limit && self._published.size() > 0) ?                                         // 296
      self._published.get(self._published.maxElementId()) : null;                                      // 297
    var maxBuffered = (limit && self._unpublishedBuffer.size() > 0) ?                                  // 298
      self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;                      // 299
    // The query is unlimited or didn't publish enough documents yet or the new                        // 300
    // document would fit into published set pushing the maximum element out,                          // 301
    // then we need to publish the doc.                                                                // 302
    var toPublish = ! limit || self._published.size() < limit ||                                       // 303
                    comparator(doc, maxPublished) < 0;                                                 // 304
                                                                                                       // 305
    // Otherwise we might need to buffer it (only in case of limited query).                           // 306
    // Buffering is allowed if the buffer is not filled up yet and all matching                        // 307
    // docs are either in the published set or in the buffer.                                          // 308
    var canAppendToBuffer = !toPublish && self._safeAppendToBuffer &&                                  // 309
                            self._unpublishedBuffer.size() < limit;                                    // 310
                                                                                                       // 311
    // Or if it is small enough to be safely inserted to the middle or the                             // 312
    // beginning of the buffer.                                                                        // 313
    var canInsertIntoBuffer = !toPublish && maxBuffered &&                                             // 314
                              comparator(doc, maxBuffered) <= 0;                                       // 315
                                                                                                       // 316
    var toBuffer = canAppendToBuffer || canInsertIntoBuffer;                                           // 317
                                                                                                       // 318
    if (toPublish) {                                                                                   // 319
      self._addPublished(id, doc);                                                                     // 320
    } else if (toBuffer) {                                                                             // 321
      self._addBuffered(id, doc);                                                                      // 322
    } else {                                                                                           // 323
      // dropping it and not saving to the cache                                                       // 324
      self._safeAppendToBuffer = false;                                                                // 325
    }                                                                                                  // 326
  },                                                                                                   // 327
  // Called when a document leaves the "Matching" results set.                                         // 328
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published                        // 329
  // and the effect of limit enforced.                                                                 // 330
  _removeMatching: function (id) {                                                                     // 331
    var self = this;                                                                                   // 332
    if (! self._published.has(id) && ! self._limit)                                                    // 333
      throw Error("tried to remove something matching but not cached " + id);                          // 334
                                                                                                       // 335
    if (self._published.has(id)) {                                                                     // 336
      self._removePublished(id);                                                                       // 337
    } else if (self._unpublishedBuffer.has(id)) {                                                      // 338
      self._removeBuffered(id);                                                                        // 339
    }                                                                                                  // 340
  },                                                                                                   // 341
  _handleDoc: function (id, newDoc) {                                                                  // 342
    var self = this;                                                                                   // 343
    var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;                           // 344
                                                                                                       // 345
    var publishedBefore = self._published.has(id);                                                     // 346
    var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);                               // 347
    var cachedBefore = publishedBefore || bufferedBefore;                                              // 348
                                                                                                       // 349
    if (matchesNow && !cachedBefore) {                                                                 // 350
      self._addMatching(newDoc);                                                                       // 351
    } else if (cachedBefore && !matchesNow) {                                                          // 352
      self._removeMatching(id);                                                                        // 353
    } else if (cachedBefore && matchesNow) {                                                           // 354
      var oldDoc = self._published.get(id);                                                            // 355
      var comparator = self._comparator;                                                               // 356
      var minBuffered = self._limit && self._unpublishedBuffer.size() &&                               // 357
        self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());                           // 358
                                                                                                       // 359
      if (publishedBefore) {                                                                           // 360
        // Unlimited case where the document stays in published once it matches                        // 361
        // or the case when we don't have enough matching docs to publish or the                       // 362
        // changed but matching doc will stay in published anyways.                                    // 363
        // XXX: We rely on the emptiness of buffer. Be sure to maintain the fact                       // 364
        // that buffer can't be empty if there are matching documents not                              // 365
        // published. Notably, we don't want to schedule repoll and continue                           // 366
        // relying on this property.                                                                   // 367
        var staysInPublished = ! self._limit ||                                                        // 368
                               self._unpublishedBuffer.size() === 0 ||                                 // 369
                               comparator(newDoc, minBuffered) <= 0;                                   // 370
                                                                                                       // 371
        if (staysInPublished) {                                                                        // 372
          self._changePublished(id, oldDoc, newDoc);                                                   // 373
        } else {                                                                                       // 374
          // after the change doc doesn't stay in the published, remove it                             // 375
          self._removePublished(id);                                                                   // 376
          // but it can move into buffered now, check it                                               // 377
          var maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());       // 378
                                                                                                       // 379
          var toBuffer = self._safeAppendToBuffer ||                                                   // 380
                         (maxBuffered && comparator(newDoc, maxBuffered) <= 0);                        // 381
                                                                                                       // 382
          if (toBuffer) {                                                                              // 383
            self._addBuffered(id, newDoc);                                                             // 384
          } else {                                                                                     // 385
            // Throw away from both published set and buffer                                           // 386
            self._safeAppendToBuffer = false;                                                          // 387
          }                                                                                            // 388
        }                                                                                              // 389
      } else if (bufferedBefore) {                                                                     // 390
        oldDoc = self._unpublishedBuffer.get(id);                                                      // 391
        // remove the old version manually so we don't trigger the querying                            // 392
        // immediately                                                                                 // 393
        self._unpublishedBuffer.remove(id);                                                            // 394
                                                                                                       // 395
        var maxPublished = self._published.get(self._published.maxElementId());                        // 396
        var maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                                                                                                       // 398
        // the buffered doc was updated, it could move to published                                    // 399
        var toPublish = comparator(newDoc, maxPublished) < 0;                                          // 400
                                                                                                       // 401
        // or stays in buffer even after the change                                                    // 402
        var staysInBuffer = (! toPublish && self._safeAppendToBuffer) ||                               // 403
          (!toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0);                         // 404
                                                                                                       // 405
        if (toPublish) {                                                                               // 406
          self._addPublished(id, newDoc);                                                              // 407
        } else if (staysInBuffer) {                                                                    // 408
          // stays in buffer but changes                                                               // 409
          self._unpublishedBuffer.set(id, newDoc);                                                     // 410
        } else {                                                                                       // 411
          // Throw away from both published set and buffer                                             // 412
          self._safeAppendToBuffer = false;                                                            // 413
        }                                                                                              // 414
      } else {                                                                                         // 415
        throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");  // 416
      }                                                                                                // 417
    }                                                                                                  // 418
  },                                                                                                   // 419
  _fetchModifiedDocuments: function () {                                                               // 420
    var self = this;                                                                                   // 421
    self._registerPhaseChange(PHASE.FETCHING);                                                         // 422
    // Defer, because nothing called from the oplog entry handler may yield, but                       // 423
    // fetch() yields.                                                                                 // 424
    Meteor.defer(finishIfNeedToPollQuery(function () {                                                 // 425
      while (!self._stopped && !self._needToFetch.empty()) {                                           // 426
        if (self._phase !== PHASE.FETCHING)                                                            // 427
          throw new Error("phase in fetchModifiedDocuments: " + self._phase);                          // 428
                                                                                                       // 429
        self._currentlyFetching = self._needToFetch;                                                   // 430
        var thisGeneration = ++self._fetchGeneration;                                                  // 431
        self._needToFetch = new LocalCollection._IdMap;                                                // 432
        var waiting = 0;                                                                               // 433
        var fut = new Future;                                                                          // 434
        // This loop is safe, because _currentlyFetching will not be updated                           // 435
        // during this loop (in fact, it is never mutated).                                            // 436
        self._currentlyFetching.forEach(function (cacheKey, id) {                                      // 437
          waiting++;                                                                                   // 438
          self._mongoHandle._docFetcher.fetch(                                                         // 439
            self._cursorDescription.collectionName, id, cacheKey,                                      // 440
            finishIfNeedToPollQuery(function (err, doc) {                                              // 441
              try {                                                                                    // 442
                if (err) {                                                                             // 443
                  Meteor._debug("Got exception while fetching documents: " +                           // 444
                                err);                                                                  // 445
                  // If we get an error from the fetcher (eg, trouble connecting                       // 446
                  // to Mongo), let's just abandon the fetch phase altogether                          // 447
                  // and fall back to polling. It's not like we're getting live                        // 448
                  // updates anyway.                                                                   // 449
                  if (self._phase !== PHASE.QUERYING) {                                                // 450
                    self._needToPollQuery();                                                           // 451
                  }                                                                                    // 452
                } else if (!self._stopped && self._phase === PHASE.FETCHING                            // 453
                           && self._fetchGeneration === thisGeneration) {                              // 454
                  // We re-check the generation in case we've had an explicit                          // 455
                  // _pollQuery call (eg, in another fiber) which should                               // 456
                  // effectively cancel this round of fetches.  (_pollQuery                            // 457
                  // increments the generation.)                                                       // 458
                  self._handleDoc(id, doc);                                                            // 459
                }                                                                                      // 460
              } finally {                                                                              // 461
                waiting--;                                                                             // 462
                // Because fetch() never calls its callback synchronously, this                        // 463
                // is safe (ie, we won't call fut.return() before the forEach is                       // 464
                // done).                                                                              // 465
                if (waiting === 0)                                                                     // 466
                  fut.return();                                                                        // 467
              }                                                                                        // 468
            }));                                                                                       // 469
        });                                                                                            // 470
        fut.wait();                                                                                    // 471
        // Exit now if we've had a _pollQuery call (here or in another fiber).                         // 472
        if (self._phase === PHASE.QUERYING)                                                            // 473
          return;                                                                                      // 474
        self._currentlyFetching = null;                                                                // 475
      }                                                                                                // 476
      // We're done fetching, so we can be steady, unless we've had a _pollQuery                       // 477
      // call (here or in another fiber).                                                              // 478
      if (self._phase !== PHASE.QUERYING)                                                              // 479
        self._beSteady();                                                                              // 480
    }));                                                                                               // 481
  },                                                                                                   // 482
  _beSteady: function () {                                                                             // 483
    var self = this;                                                                                   // 484
    self._registerPhaseChange(PHASE.STEADY);                                                           // 485
    var writes = self._writesToCommitWhenWeReachSteady;                                                // 486
    self._writesToCommitWhenWeReachSteady = [];                                                        // 487
    self._multiplexer.onFlush(function () {                                                            // 488
      _.each(writes, function (w) {                                                                    // 489
        w.committed();                                                                                 // 490
      });                                                                                              // 491
    });                                                                                                // 492
  },                                                                                                   // 493
  _handleOplogEntryQuerying: function (op) {                                                           // 494
    var self = this;                                                                                   // 495
    self._needToFetch.set(idForOp(op), op.ts.toString());                                              // 496
  },                                                                                                   // 497
  _handleOplogEntrySteadyOrFetching: function (op) {                                                   // 498
    var self = this;                                                                                   // 499
    var id = idForOp(op);                                                                              // 500
    // If we're already fetching this one, or about to, we can't optimize; make                        // 501
    // sure that we fetch it again if necessary.                                                       // 502
    if (self._phase === PHASE.FETCHING &&                                                              // 503
        ((self._currentlyFetching && self._currentlyFetching.has(id)) ||                               // 504
         self._needToFetch.has(id))) {                                                                 // 505
      self._needToFetch.set(id, op.ts.toString());                                                     // 506
      return;                                                                                          // 507
    }                                                                                                  // 508
                                                                                                       // 509
    if (op.op === 'd') {                                                                               // 510
      if (self._published.has(id) || (self._limit && self._unpublishedBuffer.has(id)))                 // 511
        self._removeMatching(id);                                                                      // 512
    } else if (op.op === 'i') {                                                                        // 513
      if (self._published.has(id))                                                                     // 514
        throw new Error("insert found for already-existing ID in published");                          // 515
      if (self._unpublishedBuffer && self._unpublishedBuffer.has(id))                                  // 516
        throw new Error("insert found for already-existing ID in buffer");                             // 517
                                                                                                       // 518
      // XXX what if selector yields?  for now it can't but later it could have                        // 519
      // $where                                                                                        // 520
      if (self._matcher.documentMatches(op.o).result)                                                  // 521
        self._addMatching(op.o);                                                                       // 522
    } else if (op.op === 'u') {                                                                        // 523
      // Is this a modifier ($set/$unset, which may require us to poll the                             // 524
      // database to figure out if the whole document matches the selector) or a                       // 525
      // replacement (in which case we can just directly re-evaluate the                               // 526
      // selector)?                                                                                    // 527
      var isReplace = !_.has(op.o, '$set') && !_.has(op.o, '$unset');                                  // 528
      // If this modifier modifies something inside an EJSON custom type (ie,                          // 529
      // anything with EJSON$), then we can't try to use                                               // 530
      // LocalCollection._modify, since that just mutates the EJSON encoding,                          // 531
      // not the actual object.                                                                        // 532
      var canDirectlyModifyDoc =                                                                       // 533
            !isReplace && modifierCanBeDirectlyApplied(op.o);                                          // 534
                                                                                                       // 535
      var publishedBefore = self._published.has(id);                                                   // 536
      var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);                             // 537
                                                                                                       // 538
      if (isReplace) {                                                                                 // 539
        self._handleDoc(id, _.extend({_id: id}, op.o));                                                // 540
      } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {                        // 541
        // Oh great, we actually know what the document is, so we can apply                            // 542
        // this directly.                                                                              // 543
        var newDoc = self._published.has(id) ?                                                         // 544
          self._published.get(id) :                                                                    // 545
          self._unpublishedBuffer.get(id);                                                             // 546
        newDoc = EJSON.clone(newDoc);                                                                  // 547
                                                                                                       // 548
        newDoc._id = id;                                                                               // 549
        LocalCollection._modify(newDoc, op.o);                                                         // 550
        self._handleDoc(id, self._sharedProjectionFn(newDoc));                                         // 551
      } else if (!canDirectlyModifyDoc ||                                                              // 552
                 self._matcher.canBecomeTrueByModifier(op.o) ||                                        // 553
                 (self._sorter && self._sorter.affectedByModifier(op.o))) {                            // 554
        self._needToFetch.set(id, op.ts.toString());                                                   // 555
        if (self._phase === PHASE.STEADY)                                                              // 556
          self._fetchModifiedDocuments();                                                              // 557
      }                                                                                                // 558
    } else {                                                                                           // 559
      throw Error("XXX SURPRISING OPERATION: " + op);                                                  // 560
    }                                                                                                  // 561
  },                                                                                                   // 562
  _runInitialQuery: function () {                                                                      // 563
    var self = this;                                                                                   // 564
    if (self._stopped)                                                                                 // 565
      throw new Error("oplog stopped surprisingly early");                                             // 566
                                                                                                       // 567
    self._runQuery();                                                                                  // 568
                                                                                                       // 569
    if (self._stopped)                                                                                 // 570
      throw new Error("oplog stopped quite early");                                                    // 571
    // Allow observeChanges calls to return. (After this, it's possible for                            // 572
    // stop() to be called.)                                                                           // 573
    self._multiplexer.ready();                                                                         // 574
                                                                                                       // 575
    self._doneQuerying();                                                                              // 576
  },                                                                                                   // 577
                                                                                                       // 578
  // In various circumstances, we may just want to stop processing the oplog and                       // 579
  // re-run the initial query, just as if we were a PollingObserveDriver.                              // 580
  //                                                                                                   // 581
  // This function may not block, because it is called from an oplog entry                             // 582
  // handler.                                                                                          // 583
  //                                                                                                   // 584
  // XXX We should call this when we detect that we've been in FETCHING for "too                       // 585
  // long".                                                                                            // 586
  //                                                                                                   // 587
  // XXX We should call this when we detect Mongo failover (since that might                           // 588
  // mean that some of the oplog entries we have processed have been rolled                            // 589
  // back). The Node Mongo driver is in the middle of a bunch of huge                                  // 590
  // refactorings, including the way that it notifies you when primary                                 // 591
  // changes. Will put off implementing this until driver 1.4 is out.                                  // 592
  _pollQuery: function () {                                                                            // 593
    var self = this;                                                                                   // 594
                                                                                                       // 595
    if (self._stopped)                                                                                 // 596
      return;                                                                                          // 597
                                                                                                       // 598
    // Yay, we get to forget about all the things we thought we had to fetch.                          // 599
    self._needToFetch = new LocalCollection._IdMap;                                                    // 600
    self._currentlyFetching = null;                                                                    // 601
    ++self._fetchGeneration;  // ignore any in-flight fetches                                          // 602
    self._registerPhaseChange(PHASE.QUERYING);                                                         // 603
                                                                                                       // 604
    // Defer so that we don't block.  We don't need finishIfNeedToPollQuery here                       // 605
    // because SwitchedToQuery is not called in QUERYING mode.                                         // 606
    Meteor.defer(function () {                                                                         // 607
      self._runQuery();                                                                                // 608
      self._doneQuerying();                                                                            // 609
    });                                                                                                // 610
  },                                                                                                   // 611
                                                                                                       // 612
  _runQuery: function () {                                                                             // 613
    var self = this;                                                                                   // 614
    var newResults, newBuffer;                                                                         // 615
                                                                                                       // 616
    // This while loop is just to retry failures.                                                      // 617
    while (true) {                                                                                     // 618
      // If we've been stopped, we don't have to run anything any more.                                // 619
      if (self._stopped)                                                                               // 620
        return;                                                                                        // 621
                                                                                                       // 622
      newResults = new LocalCollection._IdMap;                                                         // 623
      newBuffer = new LocalCollection._IdMap;                                                          // 624
                                                                                                       // 625
      // Query 2x documents as the half excluded from the original query will go                       // 626
      // into unpublished buffer to reduce additional Mongo lookups in cases                           // 627
      // when documents are removed from the published set and need a                                  // 628
      // replacement.                                                                                  // 629
      // XXX needs more thought on non-zero skip                                                       // 630
      // XXX 2 is a "magic number" meaning there is an extra chunk of docs for                         // 631
      // buffer if such is needed.                                                                     // 632
      var cursor = self._cursorForQuery({ limit: self._limit * 2 });                                   // 633
      try {                                                                                            // 634
        cursor.forEach(function (doc, i) {                                                             // 635
          if (!self._limit || i < self._limit)                                                         // 636
            newResults.set(doc._id, doc);                                                              // 637
          else                                                                                         // 638
            newBuffer.set(doc._id, doc);                                                               // 639
        });                                                                                            // 640
        break;                                                                                         // 641
      } catch (e) {                                                                                    // 642
        // During failover (eg) if we get an exception we should log and retry                         // 643
        // instead of crashing.                                                                        // 644
        Meteor._debug("Got exception while polling query: " + e);                                      // 645
        Meteor._sleepForMs(100);                                                                       // 646
      }                                                                                                // 647
    }                                                                                                  // 648
                                                                                                       // 649
    self._publishNewResults(newResults, newBuffer);                                                    // 650
  },                                                                                                   // 651
                                                                                                       // 652
  // Transitions to QUERYING and runs another query, or (if already in QUERYING)                       // 653
  // ensures that we will query again later.                                                           // 654
  //                                                                                                   // 655
  // This function may not block, because it is called from an oplog entry                             // 656
  // handler. However, if we were not already in the QUERYING phase, it throws                         // 657
  // an exception that is caught by the closest surrounding                                            // 658
  // finishIfNeedToPollQuery call; this ensures that we don't continue running                         // 659
  // close that was designed for another phase inside PHASE.QUERYING.                                  // 660
  //                                                                                                   // 661
  // (It's also necessary whenever logic in this file yields to check that other                       // 662
  // phases haven't put us into QUERYING mode, though; eg,                                             // 663
  // _fetchModifiedDocuments does this.)                                                               // 664
  _needToPollQuery: function () {                                                                      // 665
    var self = this;                                                                                   // 666
    if (self._stopped)                                                                                 // 667
      return;                                                                                          // 668
                                                                                                       // 669
    // If we're not already in the middle of a query, we can query now (possibly                       // 670
    // pausing FETCHING).                                                                              // 671
    if (self._phase !== PHASE.QUERYING) {                                                              // 672
      self._pollQuery();                                                                               // 673
      throw new SwitchedToQuery;                                                                       // 674
    }                                                                                                  // 675
                                                                                                       // 676
    // We're currently in QUERYING. Set a flag to ensure that we run another                           // 677
    // query when we're done.                                                                          // 678
    self._requeryWhenDoneThisQuery = true;                                                             // 679
  },                                                                                                   // 680
                                                                                                       // 681
  _doneQuerying: function () {                                                                         // 682
    var self = this;                                                                                   // 683
                                                                                                       // 684
    if (self._stopped)                                                                                 // 685
      return;                                                                                          // 686
    self._mongoHandle._oplogHandle.waitUntilCaughtUp();                                                // 687
                                                                                                       // 688
    if (self._stopped)                                                                                 // 689
      return;                                                                                          // 690
    if (self._phase !== PHASE.QUERYING)                                                                // 691
      throw Error("Phase unexpectedly " + self._phase);                                                // 692
                                                                                                       // 693
    if (self._requeryWhenDoneThisQuery) {                                                              // 694
      self._requeryWhenDoneThisQuery = false;                                                          // 695
      self._pollQuery();                                                                               // 696
    } else if (self._needToFetch.empty()) {                                                            // 697
      self._beSteady();                                                                                // 698
    } else {                                                                                           // 699
      self._fetchModifiedDocuments();                                                                  // 700
    }                                                                                                  // 701
  },                                                                                                   // 702
                                                                                                       // 703
  _cursorForQuery: function (optionsOverwrite) {                                                       // 704
    var self = this;                                                                                   // 705
                                                                                                       // 706
    // The query we run is almost the same as the cursor we are observing, with                        // 707
    // a few changes. We need to read all the fields that are relevant to the                          // 708
    // selector, not just the fields we are going to publish (that's the                               // 709
    // "shared" projection). And we don't want to apply any transform in the                           // 710
    // cursor, because observeChanges shouldn't use the transform.                                     // 711
    var options = _.clone(self._cursorDescription.options);                                            // 712
                                                                                                       // 713
    // Allow the caller to modify the options. Useful to specify different skip                        // 714
    // and limit values.                                                                               // 715
    _.extend(options, optionsOverwrite);                                                               // 716
                                                                                                       // 717
    options.fields = self._sharedProjection;                                                           // 718
    delete options.transform;                                                                          // 719
    // We are NOT deep cloning fields or selector here, which should be OK.                            // 720
    var description = new CursorDescription(                                                           // 721
      self._cursorDescription.collectionName,                                                          // 722
      self._cursorDescription.selector,                                                                // 723
      options);                                                                                        // 724
    return new Cursor(self._mongoHandle, description);                                                 // 725
  },                                                                                                   // 726
                                                                                                       // 727
                                                                                                       // 728
  // Replace self._published with newResults (both are IdMaps), invoking observe                       // 729
  // callbacks on the multiplexer.                                                                     // 730
  // Replace self._unpublishedBuffer with newBuffer.                                                   // 731
  //                                                                                                   // 732
  // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We                        // 733
  // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict (b)                     // 734
  // Rewrite diff.js to use these classes instead of arrays and objects.                               // 735
  _publishNewResults: function (newResults, newBuffer) {                                               // 736
    var self = this;                                                                                   // 737
                                                                                                       // 738
    // If the query is limited and there is a buffer, shut down so it doesn't                          // 739
    // stay in a way.                                                                                  // 740
    if (self._limit) {                                                                                 // 741
      self._unpublishedBuffer.clear();                                                                 // 742
    }                                                                                                  // 743
                                                                                                       // 744
    // First remove anything that's gone. Be careful not to modify                                     // 745
    // self._published while iterating over it.                                                        // 746
    var idsToRemove = [];                                                                              // 747
    self._published.forEach(function (doc, id) {                                                       // 748
      if (!newResults.has(id))                                                                         // 749
        idsToRemove.push(id);                                                                          // 750
    });                                                                                                // 751
    _.each(idsToRemove, function (id) {                                                                // 752
      self._removePublished(id);                                                                       // 753
    });                                                                                                // 754
                                                                                                       // 755
    // Now do adds and changes.                                                                        // 756
    // If self has a buffer and limit, the new fetched result will be                                  // 757
    // limited correctly as the query has sort specifier.                                              // 758
    newResults.forEach(function (doc, id) {                                                            // 759
      self._handleDoc(id, doc);                                                                        // 760
    });                                                                                                // 761
                                                                                                       // 762
    // Sanity-check that everything we tried to put into _published ended up                           // 763
    // there.                                                                                          // 764
    // XXX if this is slow, remove it later                                                            // 765
    if (self._published.size() !== newResults.size()) {                                                // 766
      throw Error("failed to copy newResults into _published!");                                       // 767
    }                                                                                                  // 768
    self._published.forEach(function (doc, id) {                                                       // 769
      if (!newResults.has(id))                                                                         // 770
        throw Error("_published has a doc that newResults doesn't; " + id);                            // 771
    });                                                                                                // 772
                                                                                                       // 773
    // Finally, replace the buffer                                                                     // 774
    newBuffer.forEach(function (doc, id) {                                                             // 775
      self._addBuffered(id, doc);                                                                      // 776
    });                                                                                                // 777
                                                                                                       // 778
    self._safeAppendToBuffer = newBuffer.size() < self._limit;                                         // 779
  },                                                                                                   // 780
                                                                                                       // 781
  // This stop function is invoked from the onStop of the ObserveMultiplexer, so                       // 782
  // it shouldn't actually be possible to call it until the multiplexer is                             // 783
  // ready.                                                                                            // 784
  stop: function () {                                                                                  // 785
    var self = this;                                                                                   // 786
    if (self._stopped)                                                                                 // 787
      return;                                                                                          // 788
    self._stopped = true;                                                                              // 789
    _.each(self._stopHandles, function (handle) {                                                      // 790
      handle.stop();                                                                                   // 791
    });                                                                                                // 792
                                                                                                       // 793
    // Note: we *don't* use multiplexer.onFlush here because this stop                                 // 794
    // callback is actually invoked by the multiplexer itself when it has                              // 795
    // determined that there are no handles left. So nothing is actually going                         // 796
    // to get flushed (and it's probably not valid to call methods on the                              // 797
    // dying multiplexer).                                                                             // 798
    _.each(self._writesToCommitWhenWeReachSteady, function (w) {                                       // 799
      w.committed();                                                                                   // 800
    });                                                                                                // 801
    self._writesToCommitWhenWeReachSteady = null;                                                      // 802
                                                                                                       // 803
    // Proactively drop references to potentially big things.                                          // 804
    self._published = null;                                                                            // 805
    self._unpublishedBuffer = null;                                                                    // 806
    self._needToFetch = null;                                                                          // 807
    self._currentlyFetching = null;                                                                    // 808
    self._oplogEntryHandle = null;                                                                     // 809
    self._listenersHandle = null;                                                                      // 810
                                                                                                       // 811
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 812
      "mongo-livedata", "observe-drivers-oplog", -1);                                                  // 813
  },                                                                                                   // 814
                                                                                                       // 815
  _registerPhaseChange: function (phase) {                                                             // 816
    var self = this;                                                                                   // 817
    var now = new Date;                                                                                // 818
                                                                                                       // 819
    if (self._phase) {                                                                                 // 820
      var timeDiff = now - self._phaseStartTime;                                                       // 821
      Package.facts && Package.facts.Facts.incrementServerFact(                                        // 822
        "mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);                        // 823
    }                                                                                                  // 824
                                                                                                       // 825
    self._phase = phase;                                                                               // 826
    self._phaseStartTime = now;                                                                        // 827
  }                                                                                                    // 828
});                                                                                                    // 829
                                                                                                       // 830
// Does our oplog tailing code support this cursor? For now, we are being very                         // 831
// conservative and allowing only simple queries with simple options.                                  // 832
// (This is a "static method".)                                                                        // 833
OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {                           // 834
  // First, check the options.                                                                         // 835
  var options = cursorDescription.options;                                                             // 836
                                                                                                       // 837
  // Did the user say no explicitly?                                                                   // 838
  if (options._disableOplog)                                                                           // 839
    return false;                                                                                      // 840
                                                                                                       // 841
  // skip is not supported: to support it we would need to keep track of all                           // 842
  // "skipped" documents or at least their ids.                                                        // 843
  // limit w/o a sort specifier is not supported: current implementation needs a                       // 844
  // deterministic way to order documents.                                                             // 845
  if (options.skip || (options.limit && !options.sort)) return false;                                  // 846
                                                                                                       // 847
  // If a fields projection option is given check if it is supported by                                // 848
  // minimongo (some operators are not supported).                                                     // 849
  if (options.fields) {                                                                                // 850
    try {                                                                                              // 851
      LocalCollection._checkSupportedProjection(options.fields);                                       // 852
    } catch (e) {                                                                                      // 853
      if (e.name === "MinimongoError")                                                                 // 854
        return false;                                                                                  // 855
      else                                                                                             // 856
        throw e;                                                                                       // 857
    }                                                                                                  // 858
  }                                                                                                    // 859
                                                                                                       // 860
  // We don't allow the following selectors:                                                           // 861
  //   - $where (not confident that we provide the same JS environment                                 // 862
  //             as Mongo, and can yield!)                                                             // 863
  //   - $near (has "interesting" properties in MongoDB, like the possibility                          // 864
  //            of returning an ID multiple times, though even polling maybe                           // 865
  //            have a bug there)                                                                      // 866
  //           XXX: once we support it, we would need to think more on how we                          // 867
  //           initialize the comparators when we create the driver.                                   // 868
  return !matcher.hasWhere() && !matcher.hasGeoQuery();                                                // 869
};                                                                                                     // 870
                                                                                                       // 871
var modifierCanBeDirectlyApplied = function (modifier) {                                               // 872
  return _.all(modifier, function (fields, operation) {                                                // 873
    return _.all(fields, function (value, field) {                                                     // 874
      return !/EJSON\$/.test(field);                                                                   // 875
    });                                                                                                // 876
  });                                                                                                  // 877
};                                                                                                     // 878
                                                                                                       // 879
MongoInternals.OplogObserveDriver = OplogObserveDriver;                                                // 880
                                                                                                       // 881
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/local_collection_driver.js                                                  //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
LocalCollectionDriver = function () {                                                                  // 1
  var self = this;                                                                                     // 2
  self.noConnCollections = {};                                                                         // 3
};                                                                                                     // 4
                                                                                                       // 5
var ensureCollection = function (name, collections) {                                                  // 6
  if (!(name in collections))                                                                          // 7
    collections[name] = new LocalCollection(name);                                                     // 8
  return collections[name];                                                                            // 9
};                                                                                                     // 10
                                                                                                       // 11
_.extend(LocalCollectionDriver.prototype, {                                                            // 12
  open: function (name, conn) {                                                                        // 13
    var self = this;                                                                                   // 14
    if (!name)                                                                                         // 15
      return new LocalCollection;                                                                      // 16
    if (! conn) {                                                                                      // 17
      return ensureCollection(name, self.noConnCollections);                                           // 18
    }                                                                                                  // 19
    if (! conn._mongo_livedata_collections)                                                            // 20
      conn._mongo_livedata_collections = {};                                                           // 21
    // XXX is there a way to keep track of a connection's collections without                          // 22
    // dangling it off the connection object?                                                          // 23
    return ensureCollection(name, conn._mongo_livedata_collections);                                   // 24
  }                                                                                                    // 25
});                                                                                                    // 26
                                                                                                       // 27
// singleton                                                                                           // 28
LocalCollectionDriver = new LocalCollectionDriver;                                                     // 29
                                                                                                       // 30
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/remote_collection_driver.js                                                 //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
MongoInternals.RemoteCollectionDriver = function (                                                     // 1
  mongo_url, options) {                                                                                // 2
  var self = this;                                                                                     // 3
  self.mongo = new MongoConnection(mongo_url, options);                                                // 4
};                                                                                                     // 5
                                                                                                       // 6
_.extend(MongoInternals.RemoteCollectionDriver.prototype, {                                            // 7
  open: function (name) {                                                                              // 8
    var self = this;                                                                                   // 9
    var ret = {};                                                                                      // 10
    _.each(                                                                                            // 11
      ['find', 'findOne', 'insert', 'update', , 'upsert',                                              // 12
       'remove', '_ensureIndex', '_dropIndex', '_createCappedCollection',                              // 13
       'dropCollection'],                                                                              // 14
      function (m) {                                                                                   // 15
        ret[m] = _.bind(self.mongo[m], self.mongo, name);                                              // 16
      });                                                                                              // 17
    return ret;                                                                                        // 18
  }                                                                                                    // 19
});                                                                                                    // 20
                                                                                                       // 21
                                                                                                       // 22
// Create the singleton RemoteCollectionDriver only on demand, so we                                   // 23
// only require Mongo configuration if it's actually used (eg, not if                                  // 24
// you're only trying to receive data from a remote DDP server.)                                       // 25
MongoInternals.defaultRemoteCollectionDriver = _.once(function () {                                    // 26
  var mongoUrl;                                                                                        // 27
  var connectionOptions = {};                                                                          // 28
                                                                                                       // 29
  AppConfig.configurePackage("mongo-livedata", function (config) {                                     // 30
    // This will keep running if mongo gets reconfigured.  That's not ideal, but                       // 31
    // should be ok for now.                                                                           // 32
    mongoUrl = config.url;                                                                             // 33
                                                                                                       // 34
    if (config.oplog)                                                                                  // 35
      connectionOptions.oplogUrl = config.oplog;                                                       // 36
  });                                                                                                  // 37
                                                                                                       // 38
  // XXX bad error since it could also be set directly in METEOR_DEPLOY_CONFIG                         // 39
  if (! mongoUrl)                                                                                      // 40
    throw new Error("MONGO_URL must be set in environment");                                           // 41
                                                                                                       // 42
                                                                                                       // 43
  return new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);                       // 44
});                                                                                                    // 45
                                                                                                       // 46
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/collection.js                                                               //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
// options.connection, if given, is a LivedataClient or LivedataServer                                 // 1
// XXX presently there is no way to destroy/clean up a Collection                                      // 2
                                                                                                       // 3
Meteor.Collection = function (name, options) {                                                         // 4
  var self = this;                                                                                     // 5
  if (! (self instanceof Meteor.Collection))                                                           // 6
    throw new Error('use "new" to construct a Meteor.Collection');                                     // 7
                                                                                                       // 8
  if (!name && (name !== null)) {                                                                      // 9
    Meteor._debug("Warning: creating anonymous collection. It will not be " +                          // 10
                  "saved or synchronized over the network. (Pass null for " +                          // 11
                  "the collection name to turn off this warning.)");                                   // 12
    name = null;                                                                                       // 13
  }                                                                                                    // 14
                                                                                                       // 15
  if (name !== null && typeof name !== "string") {                                                     // 16
    throw new Error(                                                                                   // 17
      "First argument to new Meteor.Collection must be a string or null");                             // 18
  }                                                                                                    // 19
                                                                                                       // 20
  if (options && options.methods) {                                                                    // 21
    // Backwards compatibility hack with original signature (which passed                              // 22
    // "connection" directly instead of in options. (Connections must have a "methods"                 // 23
    // method.)                                                                                        // 24
    // XXX remove before 1.0                                                                           // 25
    options = {connection: options};                                                                   // 26
  }                                                                                                    // 27
  // Backwards compatibility: "connection" used to be called "manager".                                // 28
  if (options && options.manager && !options.connection) {                                             // 29
    options.connection = options.manager;                                                              // 30
  }                                                                                                    // 31
  options = _.extend({                                                                                 // 32
    connection: undefined,                                                                             // 33
    idGeneration: 'STRING',                                                                            // 34
    transform: null,                                                                                   // 35
    _driver: undefined,                                                                                // 36
    _preventAutopublish: false                                                                         // 37
  }, options);                                                                                         // 38
                                                                                                       // 39
  switch (options.idGeneration) {                                                                      // 40
  case 'MONGO':                                                                                        // 41
    self._makeNewID = function () {                                                                    // 42
      var src = name ? DDP.randomStream('/collection/' + name) : Random;                               // 43
      return new Meteor.Collection.ObjectID(src.hexString(24));                                        // 44
    };                                                                                                 // 45
    break;                                                                                             // 46
  case 'STRING':                                                                                       // 47
  default:                                                                                             // 48
    self._makeNewID = function () {                                                                    // 49
      var src = name ? DDP.randomStream('/collection/' + name) : Random;                               // 50
      return src.id();                                                                                 // 51
    };                                                                                                 // 52
    break;                                                                                             // 53
  }                                                                                                    // 54
                                                                                                       // 55
  self._transform = LocalCollection.wrapTransform(options.transform);                                  // 56
                                                                                                       // 57
  if (! name || options.connection === null)                                                           // 58
    // note: nameless collections never have a connection                                              // 59
    self._connection = null;                                                                           // 60
  else if (options.connection)                                                                         // 61
    self._connection = options.connection;                                                             // 62
  else if (Meteor.isClient)                                                                            // 63
    self._connection = Meteor.connection;                                                              // 64
  else                                                                                                 // 65
    self._connection = Meteor.server;                                                                  // 66
                                                                                                       // 67
  if (!options._driver) {                                                                              // 68
    if (name && self._connection === Meteor.server &&                                                  // 69
        typeof MongoInternals !== "undefined" &&                                                       // 70
        MongoInternals.defaultRemoteCollectionDriver) {                                                // 71
      options._driver = MongoInternals.defaultRemoteCollectionDriver();                                // 72
    } else {                                                                                           // 73
      options._driver = LocalCollectionDriver;                                                         // 74
    }                                                                                                  // 75
  }                                                                                                    // 76
                                                                                                       // 77
  self._collection = options._driver.open(name, self._connection);                                     // 78
  self._name = name;                                                                                   // 79
                                                                                                       // 80
  if (self._connection && self._connection.registerStore) {                                            // 81
    // OK, we're going to be a slave, replicating some remote                                          // 82
    // database, except possibly with some temporary divergence while                                  // 83
    // we have unacknowledged RPC's.                                                                   // 84
    var ok = self._connection.registerStore(name, {                                                    // 85
      // Called at the beginning of a batch of updates. batchSize is the number                        // 86
      // of update calls to expect.                                                                    // 87
      //                                                                                               // 88
      // XXX This interface is pretty janky. reset probably ought to go back to                        // 89
      // being its own function, and callers shouldn't have to calculate                               // 90
      // batchSize. The optimization of not calling pause/remove should be                             // 91
      // delayed until later: the first call to update() should buffer its                             // 92
      // message, and then we can either directly apply it at endUpdate time if                        // 93
      // it was the only update, or do pauseObservers/apply/apply at the next                          // 94
      // update() if there's another one.                                                              // 95
      beginUpdate: function (batchSize, reset) {                                                       // 96
        // pause observers so users don't see flicker when updating several                            // 97
        // objects at once (including the post-reconnect reset-and-reapply                             // 98
        // stage), and so that a re-sorting of a query can take advantage of the                       // 99
        // full _diffQuery moved calculation instead of applying change one at a                       // 100
        // time.                                                                                       // 101
        if (batchSize > 1 || reset)                                                                    // 102
          self._collection.pauseObservers();                                                           // 103
                                                                                                       // 104
        if (reset)                                                                                     // 105
          self._collection.remove({});                                                                 // 106
      },                                                                                               // 107
                                                                                                       // 108
      // Apply an update.                                                                              // 109
      // XXX better specify this interface (not in terms of a wire message)?                           // 110
      update: function (msg) {                                                                         // 111
        var mongoId = LocalCollection._idParse(msg.id);                                                // 112
        var doc = self._collection.findOne(mongoId);                                                   // 113
                                                                                                       // 114
        // Is this a "replace the whole doc" message coming from the quiescence                        // 115
        // of method writes to an object? (Note that 'undefined' is a valid                            // 116
        // value meaning "remove it".)                                                                 // 117
        if (msg.msg === 'replace') {                                                                   // 118
          var replace = msg.replace;                                                                   // 119
          if (!replace) {                                                                              // 120
            if (doc)                                                                                   // 121
              self._collection.remove(mongoId);                                                        // 122
          } else if (!doc) {                                                                           // 123
            self._collection.insert(replace);                                                          // 124
          } else {                                                                                     // 125
            // XXX check that replace has no $ ops                                                     // 126
            self._collection.update(mongoId, replace);                                                 // 127
          }                                                                                            // 128
          return;                                                                                      // 129
        } else if (msg.msg === 'added') {                                                              // 130
          if (doc) {                                                                                   // 131
            throw new Error("Expected not to find a document already present for an add");             // 132
          }                                                                                            // 133
          self._collection.insert(_.extend({_id: mongoId}, msg.fields));                               // 134
        } else if (msg.msg === 'removed') {                                                            // 135
          if (!doc)                                                                                    // 136
            throw new Error("Expected to find a document already present for removed");                // 137
          self._collection.remove(mongoId);                                                            // 138
        } else if (msg.msg === 'changed') {                                                            // 139
          if (!doc)                                                                                    // 140
            throw new Error("Expected to find a document to change");                                  // 141
          if (!_.isEmpty(msg.fields)) {                                                                // 142
            var modifier = {};                                                                         // 143
            _.each(msg.fields, function (value, key) {                                                 // 144
              if (value === undefined) {                                                               // 145
                if (!modifier.$unset)                                                                  // 146
                  modifier.$unset = {};                                                                // 147
                modifier.$unset[key] = 1;                                                              // 148
              } else {                                                                                 // 149
                if (!modifier.$set)                                                                    // 150
                  modifier.$set = {};                                                                  // 151
                modifier.$set[key] = value;                                                            // 152
              }                                                                                        // 153
            });                                                                                        // 154
            self._collection.update(mongoId, modifier);                                                // 155
          }                                                                                            // 156
        } else {                                                                                       // 157
          throw new Error("I don't know how to deal with this message");                               // 158
        }                                                                                              // 159
                                                                                                       // 160
      },                                                                                               // 161
                                                                                                       // 162
      // Called at the end of a batch of updates.                                                      // 163
      endUpdate: function () {                                                                         // 164
        self._collection.resumeObservers();                                                            // 165
      },                                                                                               // 166
                                                                                                       // 167
      // Called around method stub invocations to capture the original versions                        // 168
      // of modified documents.                                                                        // 169
      saveOriginals: function () {                                                                     // 170
        self._collection.saveOriginals();                                                              // 171
      },                                                                                               // 172
      retrieveOriginals: function () {                                                                 // 173
        return self._collection.retrieveOriginals();                                                   // 174
      }                                                                                                // 175
    });                                                                                                // 176
                                                                                                       // 177
    if (!ok)                                                                                           // 178
      throw new Error("There is already a collection named '" + name + "'");                           // 179
  }                                                                                                    // 180
                                                                                                       // 181
  self._defineMutationMethods();                                                                       // 182
                                                                                                       // 183
  // autopublish                                                                                       // 184
  if (Package.autopublish && !options._preventAutopublish && self._connection                          // 185
      && self._connection.publish) {                                                                   // 186
    self._connection.publish(null, function () {                                                       // 187
      return self.find();                                                                              // 188
    }, {is_auto: true});                                                                               // 189
  }                                                                                                    // 190
};                                                                                                     // 191
                                                                                                       // 192
///                                                                                                    // 193
/// Main collection API                                                                                // 194
///                                                                                                    // 195
                                                                                                       // 196
                                                                                                       // 197
_.extend(Meteor.Collection.prototype, {                                                                // 198
                                                                                                       // 199
  _getFindSelector: function (args) {                                                                  // 200
    if (args.length == 0)                                                                              // 201
      return {};                                                                                       // 202
    else                                                                                               // 203
      return args[0];                                                                                  // 204
  },                                                                                                   // 205
                                                                                                       // 206
  _getFindOptions: function (args) {                                                                   // 207
    var self = this;                                                                                   // 208
    if (args.length < 2) {                                                                             // 209
      return { transform: self._transform };                                                           // 210
    } else {                                                                                           // 211
      check(args[1], Match.Optional(Match.ObjectIncluding({                                            // 212
        fields: Match.Optional(Match.OneOf(Object, undefined)),                                        // 213
        sort: Match.Optional(Match.OneOf(Object, Array, undefined)),                                   // 214
        limit: Match.Optional(Match.OneOf(Number, undefined)),                                         // 215
        skip: Match.Optional(Match.OneOf(Number, undefined))                                           // 216
     })));                                                                                             // 217
                                                                                                       // 218
      return _.extend({                                                                                // 219
        transform: self._transform                                                                     // 220
      }, args[1]);                                                                                     // 221
    }                                                                                                  // 222
  },                                                                                                   // 223
                                                                                                       // 224
  find: function (/* selector, options */) {                                                           // 225
    // Collection.find() (return all docs) behaves differently                                         // 226
    // from Collection.find(undefined) (return 0 docs).  so be                                         // 227
    // careful about the length of arguments.                                                          // 228
    var self = this;                                                                                   // 229
    var argArray = _.toArray(arguments);                                                               // 230
    return self._collection.find(self._getFindSelector(argArray),                                      // 231
                                 self._getFindOptions(argArray));                                      // 232
  },                                                                                                   // 233
                                                                                                       // 234
  findOne: function (/* selector, options */) {                                                        // 235
    var self = this;                                                                                   // 236
    var argArray = _.toArray(arguments);                                                               // 237
    return self._collection.findOne(self._getFindSelector(argArray),                                   // 238
                                    self._getFindOptions(argArray));                                   // 239
  }                                                                                                    // 240
                                                                                                       // 241
});                                                                                                    // 242
                                                                                                       // 243
Meteor.Collection._publishCursor = function (cursor, sub, collection) {                                // 244
  var observeHandle = cursor.observeChanges({                                                          // 245
    added: function (id, fields) {                                                                     // 246
      sub.added(collection, id, fields);                                                               // 247
    },                                                                                                 // 248
    changed: function (id, fields) {                                                                   // 249
      sub.changed(collection, id, fields);                                                             // 250
    },                                                                                                 // 251
    removed: function (id) {                                                                           // 252
      sub.removed(collection, id);                                                                     // 253
    }                                                                                                  // 254
  });                                                                                                  // 255
                                                                                                       // 256
  // We don't call sub.ready() here: it gets called in livedata_server, after                          // 257
  // possibly calling _publishCursor on multiple returned cursors.                                     // 258
                                                                                                       // 259
  // register stop callback (expects lambda w/ no args).                                               // 260
  sub.onStop(function () {observeHandle.stop();});                                                     // 261
};                                                                                                     // 262
                                                                                                       // 263
// protect against dangerous selectors.  falsey and {_id: falsey} are both                             // 264
// likely programmer error, and not what you want, particularly for destructive                        // 265
// operations.  JS regexps don't serialize over DDP but can be trivially                               // 266
// replaced by $regex.                                                                                 // 267
Meteor.Collection._rewriteSelector = function (selector) {                                             // 268
  // shorthand -- scalars match _id                                                                    // 269
  if (LocalCollection._selectorIsId(selector))                                                         // 270
    selector = {_id: selector};                                                                        // 271
                                                                                                       // 272
  if (!selector || (('_id' in selector) && !selector._id))                                             // 273
    // can't match anything                                                                            // 274
    return {_id: Random.id()};                                                                         // 275
                                                                                                       // 276
  var ret = {};                                                                                        // 277
  _.each(selector, function (value, key) {                                                             // 278
    // Mongo supports both {field: /foo/} and {field: {$regex: /foo/}}                                 // 279
    if (value instanceof RegExp) {                                                                     // 280
      ret[key] = convertRegexpToMongoSelector(value);                                                  // 281
    } else if (value && value.$regex instanceof RegExp) {                                              // 282
      ret[key] = convertRegexpToMongoSelector(value.$regex);                                           // 283
      // if value is {$regex: /foo/, $options: ...} then $options                                      // 284
      // override the ones set on $regex.                                                              // 285
      if (value.$options !== undefined)                                                                // 286
        ret[key].$options = value.$options;                                                            // 287
    }                                                                                                  // 288
    else if (_.contains(['$or','$and','$nor'], key)) {                                                 // 289
      // Translate lower levels of $and/$or/$nor                                                       // 290
      ret[key] = _.map(value, function (v) {                                                           // 291
        return Meteor.Collection._rewriteSelector(v);                                                  // 292
      });                                                                                              // 293
    } else {                                                                                           // 294
      ret[key] = value;                                                                                // 295
    }                                                                                                  // 296
  });                                                                                                  // 297
  return ret;                                                                                          // 298
};                                                                                                     // 299
                                                                                                       // 300
// convert a JS RegExp object to a Mongo {$regex: ..., $options: ...}                                  // 301
// selector                                                                                            // 302
var convertRegexpToMongoSelector = function (regexp) {                                                 // 303
  check(regexp, RegExp); // safety belt                                                                // 304
                                                                                                       // 305
  var selector = {$regex: regexp.source};                                                              // 306
  var regexOptions = '';                                                                               // 307
  // JS RegExp objects support 'i', 'm', and 'g'. Mongo regex $options                                 // 308
  // support 'i', 'm', 'x', and 's'. So we support 'i' and 'm' here.                                   // 309
  if (regexp.ignoreCase)                                                                               // 310
    regexOptions += 'i';                                                                               // 311
  if (regexp.multiline)                                                                                // 312
    regexOptions += 'm';                                                                               // 313
  if (regexOptions)                                                                                    // 314
    selector.$options = regexOptions;                                                                  // 315
                                                                                                       // 316
  return selector;                                                                                     // 317
};                                                                                                     // 318
                                                                                                       // 319
var throwIfSelectorIsNotId = function (selector, methodName) {                                         // 320
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {                                       // 321
    throw new Meteor.Error(                                                                            // 322
      403, "Not permitted. Untrusted code may only " + methodName +                                    // 323
        " documents by ID.");                                                                          // 324
  }                                                                                                    // 325
};                                                                                                     // 326
                                                                                                       // 327
// 'insert' immediately returns the inserted document's new _id.                                       // 328
// The others return values immediately if you are in a stub, an in-memory                             // 329
// unmanaged collection, or a mongo-backed collection and you don't pass a                             // 330
// callback. 'update' and 'remove' return the number of affected                                       // 331
// documents. 'upsert' returns an object with keys 'numberAffected' and, if an                         // 332
// insert happened, 'insertedId'.                                                                      // 333
//                                                                                                     // 334
// Otherwise, the semantics are exactly like other methods: they take                                  // 335
// a callback as an optional last argument; if no callback is                                          // 336
// provided, they block until the operation is complete, and throw an                                  // 337
// exception if it fails; if a callback is provided, then they don't                                   // 338
// necessarily block, and they call the callback when they finish with error and                       // 339
// result arguments.  (The insert method provides the document ID as its result;                       // 340
// update and remove provide the number of affected docs as the result; upsert                         // 341
// provides an object with numberAffected and maybe insertedId.)                                       // 342
//                                                                                                     // 343
// On the client, blocking is impossible, so if a callback                                             // 344
// isn't provided, they just return immediately and any error                                          // 345
// information is lost.                                                                                // 346
//                                                                                                     // 347
// There's one more tweak. On the client, if you don't provide a                                       // 348
// callback, then if there is an error, a message will be logged with                                  // 349
// Meteor._debug.                                                                                      // 350
//                                                                                                     // 351
// The intent (though this is actually determined by the underlying                                    // 352
// drivers) is that the operations should be done synchronously, not                                   // 353
// generating their result until the database has acknowledged                                         // 354
// them. In the future maybe we should provide a flag to turn this                                     // 355
// off.                                                                                                // 356
_.each(["insert", "update", "remove"], function (name) {                                               // 357
  Meteor.Collection.prototype[name] = function (/* arguments */) {                                     // 358
    var self = this;                                                                                   // 359
    var args = _.toArray(arguments);                                                                   // 360
    var callback;                                                                                      // 361
    var insertId;                                                                                      // 362
    var ret;                                                                                           // 363
                                                                                                       // 364
    if (args.length && args[args.length - 1] instanceof Function)                                      // 365
      callback = args.pop();                                                                           // 366
                                                                                                       // 367
    if (name === "insert") {                                                                           // 368
      if (!args.length)                                                                                // 369
        throw new Error("insert requires an argument");                                                // 370
      // shallow-copy the document and generate an ID                                                  // 371
      args[0] = _.extend({}, args[0]);                                                                 // 372
      if ('_id' in args[0]) {                                                                          // 373
        insertId = args[0]._id;                                                                        // 374
        if (!insertId || !(typeof insertId === 'string'                                                // 375
              || insertId instanceof Meteor.Collection.ObjectID))                                      // 376
          throw new Error("Meteor requires document _id fields to be non-empty strings or ObjectIDs"); // 377
      } else {                                                                                         // 378
        var generateId = true;                                                                         // 379
        // Don't generate the id if we're the client and the 'outermost' call                          // 380
        // This optimization saves us passing both the randomSeed and the id                           // 381
        // Passing both is redundant.                                                                  // 382
        if (self._connection && self._connection !== Meteor.server) {                                  // 383
          var enclosing = DDP._CurrentInvocation.get();                                                // 384
          if (!enclosing) {                                                                            // 385
            generateId = false;                                                                        // 386
          }                                                                                            // 387
        }                                                                                              // 388
        if (generateId) {                                                                              // 389
          insertId = args[0]._id = self._makeNewID();                                                  // 390
        }                                                                                              // 391
      }                                                                                                // 392
    } else {                                                                                           // 393
      args[0] = Meteor.Collection._rewriteSelector(args[0]);                                           // 394
                                                                                                       // 395
      if (name === "update") {                                                                         // 396
        // Mutate args but copy the original options object. We need to add                            // 397
        // insertedId to options, but don't want to mutate the caller's options                        // 398
        // object. We need to mutate `args` because we pass `args` into the                            // 399
        // driver below.                                                                               // 400
        var options = args[2] = _.clone(args[2]) || {};                                                // 401
        if (options && typeof options !== "function" && options.upsert) {                              // 402
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.                          // 403
          if (options.insertedId) {                                                                    // 404
            if (!(typeof options.insertedId === 'string'                                               // 405
                  || options.insertedId instanceof Meteor.Collection.ObjectID))                        // 406
              throw new Error("insertedId must be string or ObjectID");                                // 407
          } else {                                                                                     // 408
            options.insertedId = self._makeNewID();                                                    // 409
          }                                                                                            // 410
        }                                                                                              // 411
      }                                                                                                // 412
    }                                                                                                  // 413
                                                                                                       // 414
    // On inserts, always return the id that we generated; on all other                                // 415
    // operations, just return the result from the collection.                                         // 416
    var chooseReturnValueFromCollectionResult = function (result) {                                    // 417
      if (name === "insert") {                                                                         // 418
        if (!insertId && result) {                                                                     // 419
          insertId = result;                                                                           // 420
        }                                                                                              // 421
        return insertId;                                                                               // 422
      } else {                                                                                         // 423
        return result;                                                                                 // 424
      }                                                                                                // 425
    };                                                                                                 // 426
                                                                                                       // 427
    var wrappedCallback;                                                                               // 428
    if (callback) {                                                                                    // 429
      wrappedCallback = function (error, result) {                                                     // 430
        callback(error, ! error && chooseReturnValueFromCollectionResult(result));                     // 431
      };                                                                                               // 432
    }                                                                                                  // 433
                                                                                                       // 434
    if (self._connection && self._connection !== Meteor.server) {                                      // 435
      // just remote to another endpoint, propagate return value or                                    // 436
      // exception.                                                                                    // 437
                                                                                                       // 438
      var enclosing = DDP._CurrentInvocation.get();                                                    // 439
      var alreadyInSimulation = enclosing && enclosing.isSimulation;                                   // 440
                                                                                                       // 441
      if (Meteor.isClient && !wrappedCallback && ! alreadyInSimulation) {                              // 442
        // Client can't block, so it can't report errors by exception,                                 // 443
        // only by callback. If they forget the callback, give them a                                  // 444
        // default one that logs the error, so they aren't totally                                     // 445
        // baffled if their writes don't work because their database is                                // 446
        // down.                                                                                       // 447
        // Don't give a default callback in simulation, because inside stubs we                        // 448
        // want to return the results from the local collection immediately and                        // 449
        // not force a callback.                                                                       // 450
        wrappedCallback = function (err) {                                                             // 451
          if (err)                                                                                     // 452
            Meteor._debug(name + " failed: " + (err.reason || err.stack));                             // 453
        };                                                                                             // 454
      }                                                                                                // 455
                                                                                                       // 456
      if (!alreadyInSimulation && name !== "insert") {                                                 // 457
        // If we're about to actually send an RPC, we should throw an error if                         // 458
        // this is a non-ID selector, because the mutation methods only allow                          // 459
        // single-ID selectors. (If we don't throw here, we'll see flicker.)                           // 460
        throwIfSelectorIsNotId(args[0], name);                                                         // 461
      }                                                                                                // 462
                                                                                                       // 463
      ret = chooseReturnValueFromCollectionResult(                                                     // 464
        self._connection.apply(self._prefix + name, args, {returnStubValue: true}, wrappedCallback)    // 465
      );                                                                                               // 466
                                                                                                       // 467
    } else {                                                                                           // 468
      // it's my collection.  descend into the collection object                                       // 469
      // and propagate any exception.                                                                  // 470
      args.push(wrappedCallback);                                                                      // 471
      try {                                                                                            // 472
        // If the user provided a callback and the collection implements this                          // 473
        // operation asynchronously, then queryRet will be undefined, and the                          // 474
        // result will be returned through the callback instead.                                       // 475
        var queryRet = self._collection[name].apply(self._collection, args);                           // 476
        ret = chooseReturnValueFromCollectionResult(queryRet);                                         // 477
      } catch (e) {                                                                                    // 478
        if (callback) {                                                                                // 479
          callback(e);                                                                                 // 480
          return null;                                                                                 // 481
        }                                                                                              // 482
        throw e;                                                                                       // 483
      }                                                                                                // 484
    }                                                                                                  // 485
                                                                                                       // 486
    // both sync and async, unless we threw an exception, return ret                                   // 487
    // (new document ID for insert, num affected for update/remove, object with                        // 488
    // numberAffected and maybe insertedId for upsert).                                                // 489
    return ret;                                                                                        // 490
  };                                                                                                   // 491
});                                                                                                    // 492
                                                                                                       // 493
Meteor.Collection.prototype.upsert = function (selector, modifier,                                     // 494
                                               options, callback) {                                    // 495
  var self = this;                                                                                     // 496
  if (! callback && typeof options === "function") {                                                   // 497
    callback = options;                                                                                // 498
    options = {};                                                                                      // 499
  }                                                                                                    // 500
  return self.update(selector, modifier,                                                               // 501
              _.extend({}, options, { _returnObject: true, upsert: true }),                            // 502
              callback);                                                                               // 503
};                                                                                                     // 504
                                                                                                       // 505
// We'll actually design an index API later. For now, we just pass through to                          // 506
// Mongo's, but make it synchronous.                                                                   // 507
Meteor.Collection.prototype._ensureIndex = function (index, options) {                                 // 508
  var self = this;                                                                                     // 509
  if (!self._collection._ensureIndex)                                                                  // 510
    throw new Error("Can only call _ensureIndex on server collections");                               // 511
  self._collection._ensureIndex(index, options);                                                       // 512
};                                                                                                     // 513
Meteor.Collection.prototype._dropIndex = function (index) {                                            // 514
  var self = this;                                                                                     // 515
  if (!self._collection._dropIndex)                                                                    // 516
    throw new Error("Can only call _dropIndex on server collections");                                 // 517
  self._collection._dropIndex(index);                                                                  // 518
};                                                                                                     // 519
Meteor.Collection.prototype._dropCollection = function () {                                            // 520
  var self = this;                                                                                     // 521
  if (!self._collection.dropCollection)                                                                // 522
    throw new Error("Can only call _dropCollection on server collections");                            // 523
  self._collection.dropCollection();                                                                   // 524
};                                                                                                     // 525
Meteor.Collection.prototype._createCappedCollection = function (byteSize) {                            // 526
  var self = this;                                                                                     // 527
  if (!self._collection._createCappedCollection)                                                       // 528
    throw new Error("Can only call _createCappedCollection on server collections");                    // 529
  self._collection._createCappedCollection(byteSize);                                                  // 530
};                                                                                                     // 531
                                                                                                       // 532
Meteor.Collection.ObjectID = LocalCollection._ObjectID;                                                // 533
                                                                                                       // 534
///                                                                                                    // 535
/// Remote methods and access control.                                                                 // 536
///                                                                                                    // 537
                                                                                                       // 538
// Restrict default mutators on collection. allow() and deny() take the                                // 539
// same options:                                                                                       // 540
//                                                                                                     // 541
// options.insert {Function(userId, doc)}                                                              // 542
//   return true to allow/deny adding this document                                                    // 543
//                                                                                                     // 544
// options.update {Function(userId, docs, fields, modifier)}                                           // 545
//   return true to allow/deny updating these documents.                                               // 546
//   `fields` is passed as an array of fields that are to be modified                                  // 547
//                                                                                                     // 548
// options.remove {Function(userId, docs)}                                                             // 549
//   return true to allow/deny removing these documents                                                // 550
//                                                                                                     // 551
// options.fetch {Array}                                                                               // 552
//   Fields to fetch for these validators. If any call to allow or deny                                // 553
//   does not have this option then all fields are loaded.                                             // 554
//                                                                                                     // 555
// allow and deny can be called multiple times. The validators are                                     // 556
// evaluated as follows:                                                                               // 557
// - If neither deny() nor allow() has been called on the collection,                                  // 558
//   then the request is allowed if and only if the "insecure" smart                                   // 559
//   package is in use.                                                                                // 560
// - Otherwise, if any deny() function returns true, the request is denied.                            // 561
// - Otherwise, if any allow() function returns true, the request is allowed.                          // 562
// - Otherwise, the request is denied.                                                                 // 563
//                                                                                                     // 564
// Meteor may call your deny() and allow() functions in any order, and may not                         // 565
// call all of them if it is able to make a decision without calling them all                          // 566
// (so don't include side effects).                                                                    // 567
                                                                                                       // 568
(function () {                                                                                         // 569
  var addValidator = function(allowOrDeny, options) {                                                  // 570
    // validate keys                                                                                   // 571
    var VALID_KEYS = ['insert', 'update', 'remove', 'fetch', 'transform'];                             // 572
    _.each(_.keys(options), function (key) {                                                           // 573
      if (!_.contains(VALID_KEYS, key))                                                                // 574
        throw new Error(allowOrDeny + ": Invalid key: " + key);                                        // 575
    });                                                                                                // 576
                                                                                                       // 577
    var self = this;                                                                                   // 578
    self._restricted = true;                                                                           // 579
                                                                                                       // 580
    _.each(['insert', 'update', 'remove'], function (name) {                                           // 581
      if (options[name]) {                                                                             // 582
        if (!(options[name] instanceof Function)) {                                                    // 583
          throw new Error(allowOrDeny + ": Value for `" + name + "` must be a function");              // 584
        }                                                                                              // 585
                                                                                                       // 586
        // If the transform is specified at all (including as 'null') in this                          // 587
        // call, then take that; otherwise, take the transform from the                                // 588
        // collection.                                                                                 // 589
        if (options.transform === undefined) {                                                         // 590
          options[name].transform = self._transform;  // already wrapped                               // 591
        } else {                                                                                       // 592
          options[name].transform = LocalCollection.wrapTransform(                                     // 593
            options.transform);                                                                        // 594
        }                                                                                              // 595
                                                                                                       // 596
        self._validators[name][allowOrDeny].push(options[name]);                                       // 597
      }                                                                                                // 598
    });                                                                                                // 599
                                                                                                       // 600
    // Only update the fetch fields if we're passed things that affect                                 // 601
    // fetching. This way allow({}) and allow({insert: f}) don't result in                             // 602
    // setting fetchAllFields                                                                          // 603
    if (options.update || options.remove || options.fetch) {                                           // 604
      if (options.fetch && !(options.fetch instanceof Array)) {                                        // 605
        throw new Error(allowOrDeny + ": Value for `fetch` must be an array");                         // 606
      }                                                                                                // 607
      self._updateFetch(options.fetch);                                                                // 608
    }                                                                                                  // 609
  };                                                                                                   // 610
                                                                                                       // 611
  Meteor.Collection.prototype.allow = function(options) {                                              // 612
    addValidator.call(this, 'allow', options);                                                         // 613
  };                                                                                                   // 614
  Meteor.Collection.prototype.deny = function(options) {                                               // 615
    addValidator.call(this, 'deny', options);                                                          // 616
  };                                                                                                   // 617
})();                                                                                                  // 618
                                                                                                       // 619
                                                                                                       // 620
Meteor.Collection.prototype._defineMutationMethods = function() {                                      // 621
  var self = this;                                                                                     // 622
                                                                                                       // 623
  // set to true once we call any allow or deny methods. If true, use                                  // 624
  // allow/deny semantics. If false, use insecure mode semantics.                                      // 625
  self._restricted = false;                                                                            // 626
                                                                                                       // 627
  // Insecure mode (default to allowing writes). Defaults to 'undefined' which                         // 628
  // means insecure iff the insecure package is loaded. This property can be                           // 629
  // overriden by tests or packages wishing to change insecure mode behavior of                        // 630
  // their collections.                                                                                // 631
  self._insecure = undefined;                                                                          // 632
                                                                                                       // 633
  self._validators = {                                                                                 // 634
    insert: {allow: [], deny: []},                                                                     // 635
    update: {allow: [], deny: []},                                                                     // 636
    remove: {allow: [], deny: []},                                                                     // 637
    upsert: {allow: [], deny: []}, // dummy arrays; can't set these!                                   // 638
    fetch: [],                                                                                         // 639
    fetchAllFields: false                                                                              // 640
  };                                                                                                   // 641
                                                                                                       // 642
  if (!self._name)                                                                                     // 643
    return; // anonymous collection                                                                    // 644
                                                                                                       // 645
  // XXX Think about method namespacing. Maybe methods should be                                       // 646
  // "Meteor:Mongo:insert/NAME"?                                                                       // 647
  self._prefix = '/' + self._name + '/';                                                               // 648
                                                                                                       // 649
  // mutation methods                                                                                  // 650
  if (self._connection) {                                                                              // 651
    var m = {};                                                                                        // 652
                                                                                                       // 653
    _.each(['insert', 'update', 'remove'], function (method) {                                         // 654
      m[self._prefix + method] = function (/* ... */) {                                                // 655
        // All the methods do their own validation, instead of using check().                          // 656
        check(arguments, [Match.Any]);                                                                 // 657
        var args = _.toArray(arguments);                                                               // 658
        try {                                                                                          // 659
          // For an insert, if the client didn't specify an _id, generate one                          // 660
          // now; because this uses DDP.randomStream, it will be consistent with                       // 661
          // what the client generated. We generate it now rather than later so                        // 662
          // that if (eg) an allow/deny rule does an insert to the same                                // 663
          // collection (not that it really should), the generated _id will                            // 664
          // still be the first use of the stream and will be consistent.                              // 665
          //                                                                                           // 666
          // However, we don't actually stick the _id onto the document yet,                           // 667
          // because we want allow/deny rules to be able to differentiate                              // 668
          // between arbitrary client-specified _id fields and merely                                  // 669
          // client-controlled-via-randomSeed fields.                                                  // 670
          var generatedId = null;                                                                      // 671
          if (method === "insert" && !_.has(args[0], '_id')) {                                         // 672
            generatedId = self._makeNewID();                                                           // 673
          }                                                                                            // 674
                                                                                                       // 675
          if (this.isSimulation) {                                                                     // 676
            // In a client simulation, you can do any mutation (even with a                            // 677
            // complex selector).                                                                      // 678
            if (generatedId !== null)                                                                  // 679
              args[0]._id = generatedId;                                                               // 680
            return self._collection[method].apply(                                                     // 681
              self._collection, args);                                                                 // 682
          }                                                                                            // 683
                                                                                                       // 684
          // This is the server receiving a method call from the client.                               // 685
                                                                                                       // 686
          // We don't allow arbitrary selectors in mutations from the client: only                     // 687
          // single-ID selectors.                                                                      // 688
          if (method !== 'insert')                                                                     // 689
            throwIfSelectorIsNotId(args[0], method);                                                   // 690
                                                                                                       // 691
          if (self._restricted) {                                                                      // 692
            // short circuit if there is no way it will pass.                                          // 693
            if (self._validators[method].allow.length === 0) {                                         // 694
              throw new Meteor.Error(                                                                  // 695
                403, "Access denied. No allow validators set on restricted " +                         // 696
                  "collection for method '" + method + "'.");                                          // 697
            }                                                                                          // 698
                                                                                                       // 699
            var validatedMethodName =                                                                  // 700
                  '_validated' + method.charAt(0).toUpperCase() + method.slice(1);                     // 701
            args.unshift(this.userId);                                                                 // 702
            method === 'insert' && args.push(generatedId);                                             // 703
            return self[validatedMethodName].apply(self, args);                                        // 704
          } else if (self._isInsecure()) {                                                             // 705
            if (generatedId !== null)                                                                  // 706
              args[0]._id = generatedId;                                                               // 707
            // In insecure mode, allow any mutation (with a simple selector).                          // 708
            return self._collection[method].apply(self._collection, args);                             // 709
          } else {                                                                                     // 710
            // In secure mode, if we haven't called allow or deny, then nothing                        // 711
            // is permitted.                                                                           // 712
            throw new Meteor.Error(403, "Access denied");                                              // 713
          }                                                                                            // 714
        } catch (e) {                                                                                  // 715
          if (e.name === 'MongoError' || e.name === 'MinimongoError') {                                // 716
            throw new Meteor.Error(409, e.toString());                                                 // 717
          } else {                                                                                     // 718
            throw e;                                                                                   // 719
          }                                                                                            // 720
        }                                                                                              // 721
      };                                                                                               // 722
    });                                                                                                // 723
    // Minimongo on the server gets no stubs; instead, by default                                      // 724
    // it wait()s until its result is ready, yielding.                                                 // 725
    // This matches the behavior of macromongo on the server better.                                   // 726
    if (Meteor.isClient || self._connection === Meteor.server)                                         // 727
      self._connection.methods(m);                                                                     // 728
  }                                                                                                    // 729
};                                                                                                     // 730
                                                                                                       // 731
                                                                                                       // 732
Meteor.Collection.prototype._updateFetch = function (fields) {                                         // 733
  var self = this;                                                                                     // 734
                                                                                                       // 735
  if (!self._validators.fetchAllFields) {                                                              // 736
    if (fields) {                                                                                      // 737
      self._validators.fetch = _.union(self._validators.fetch, fields);                                // 738
    } else {                                                                                           // 739
      self._validators.fetchAllFields = true;                                                          // 740
      // clear fetch just to make sure we don't accidentally read it                                   // 741
      self._validators.fetch = null;                                                                   // 742
    }                                                                                                  // 743
  }                                                                                                    // 744
};                                                                                                     // 745
                                                                                                       // 746
Meteor.Collection.prototype._isInsecure = function () {                                                // 747
  var self = this;                                                                                     // 748
  if (self._insecure === undefined)                                                                    // 749
    return !!Package.insecure;                                                                         // 750
  return self._insecure;                                                                               // 751
};                                                                                                     // 752
                                                                                                       // 753
var docToValidate = function (validator, doc, generatedId) {                                           // 754
  var ret = doc;                                                                                       // 755
  if (validator.transform) {                                                                           // 756
    ret = EJSON.clone(doc);                                                                            // 757
    // If you set a server-side transform on your collection, then you don't get                       // 758
    // to tell the difference between "client specified the ID" and "server                            // 759
    // generated the ID", because transforms expect to get _id.  If you want to                        // 760
    // do that check, you can do it with a specific                                                    // 761
    // `C.allow({insert: f, transform: null})` validator.                                              // 762
    if (generatedId !== null) {                                                                        // 763
      ret._id = generatedId;                                                                           // 764
    }                                                                                                  // 765
    ret = validator.transform(ret);                                                                    // 766
  }                                                                                                    // 767
  return ret;                                                                                          // 768
};                                                                                                     // 769
                                                                                                       // 770
Meteor.Collection.prototype._validatedInsert = function (userId, doc,                                  // 771
                                                         generatedId) {                                // 772
  var self = this;                                                                                     // 773
                                                                                                       // 774
  // call user validators.                                                                             // 775
  // Any deny returns true means denied.                                                               // 776
  if (_.any(self._validators.insert.deny, function(validator) {                                        // 777
    return validator(userId, docToValidate(validator, doc, generatedId));                              // 778
  })) {                                                                                                // 779
    throw new Meteor.Error(403, "Access denied");                                                      // 780
  }                                                                                                    // 781
  // Any allow returns true means proceed. Throw error if they all fail.                               // 782
  if (_.all(self._validators.insert.allow, function(validator) {                                       // 783
    return !validator(userId, docToValidate(validator, doc, generatedId));                             // 784
  })) {                                                                                                // 785
    throw new Meteor.Error(403, "Access denied");                                                      // 786
  }                                                                                                    // 787
                                                                                                       // 788
  // If we generated an ID above, insert it now: after the validation, but                             // 789
  // before actually inserting.                                                                        // 790
  if (generatedId !== null)                                                                            // 791
    doc._id = generatedId;                                                                             // 792
                                                                                                       // 793
  self._collection.insert.call(self._collection, doc);                                                 // 794
};                                                                                                     // 795
                                                                                                       // 796
var transformDoc = function (validator, doc) {                                                         // 797
  if (validator.transform)                                                                             // 798
    return validator.transform(doc);                                                                   // 799
  return doc;                                                                                          // 800
};                                                                                                     // 801
                                                                                                       // 802
// Simulate a mongo `update` operation while validating that the access                                // 803
// control rules set by calls to `allow/deny` are satisfied. If all                                    // 804
// pass, rewrite the mongo operation to use $in to set the list of                                     // 805
// document ids to change ##ValidatedChange                                                            // 806
Meteor.Collection.prototype._validatedUpdate = function(                                               // 807
    userId, selector, mutator, options) {                                                              // 808
  var self = this;                                                                                     // 809
                                                                                                       // 810
  options = options || {};                                                                             // 811
                                                                                                       // 812
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector))                                         // 813
    throw new Error("validated update should be of a single ID");                                      // 814
                                                                                                       // 815
  // We don't support upserts because they don't fit nicely into allow/deny                            // 816
  // rules.                                                                                            // 817
  if (options.upsert)                                                                                  // 818
    throw new Meteor.Error(403, "Access denied. Upserts not " +                                        // 819
                           "allowed in a restricted collection.");                                     // 820
                                                                                                       // 821
  // compute modified fields                                                                           // 822
  var fields = [];                                                                                     // 823
  _.each(mutator, function (params, op) {                                                              // 824
    if (op.charAt(0) !== '$') {                                                                        // 825
      throw new Meteor.Error(                                                                          // 826
        403, "Access denied. In a restricted collection you can only update documents, not replace them. Use a Mongo update operator, such as '$set'.");
    } else if (!_.has(ALLOWED_UPDATE_OPERATIONS, op)) {                                                // 828
      throw new Meteor.Error(                                                                          // 829
        403, "Access denied. Operator " + op + " not allowed in a restricted collection.");            // 830
    } else {                                                                                           // 831
      _.each(_.keys(params), function (field) {                                                        // 832
        // treat dotted fields as if they are replacing their                                          // 833
        // top-level part                                                                              // 834
        if (field.indexOf('.') !== -1)                                                                 // 835
          field = field.substring(0, field.indexOf('.'));                                              // 836
                                                                                                       // 837
        // record the field we are trying to change                                                    // 838
        if (!_.contains(fields, field))                                                                // 839
          fields.push(field);                                                                          // 840
      });                                                                                              // 841
    }                                                                                                  // 842
  });                                                                                                  // 843
                                                                                                       // 844
  var findOptions = {transform: null};                                                                 // 845
  if (!self._validators.fetchAllFields) {                                                              // 846
    findOptions.fields = {};                                                                           // 847
    _.each(self._validators.fetch, function(fieldName) {                                               // 848
      findOptions.fields[fieldName] = 1;                                                               // 849
    });                                                                                                // 850
  }                                                                                                    // 851
                                                                                                       // 852
  var doc = self._collection.findOne(selector, findOptions);                                           // 853
  if (!doc)  // none satisfied!                                                                        // 854
    return 0;                                                                                          // 855
                                                                                                       // 856
  var factoriedDoc;                                                                                    // 857
                                                                                                       // 858
  // call user validators.                                                                             // 859
  // Any deny returns true means denied.                                                               // 860
  if (_.any(self._validators.update.deny, function(validator) {                                        // 861
    if (!factoriedDoc)                                                                                 // 862
      factoriedDoc = transformDoc(validator, doc);                                                     // 863
    return validator(userId,                                                                           // 864
                     factoriedDoc,                                                                     // 865
                     fields,                                                                           // 866
                     mutator);                                                                         // 867
  })) {                                                                                                // 868
    throw new Meteor.Error(403, "Access denied");                                                      // 869
  }                                                                                                    // 870
  // Any allow returns true means proceed. Throw error if they all fail.                               // 871
  if (_.all(self._validators.update.allow, function(validator) {                                       // 872
    if (!factoriedDoc)                                                                                 // 873
      factoriedDoc = transformDoc(validator, doc);                                                     // 874
    return !validator(userId,                                                                          // 875
                      factoriedDoc,                                                                    // 876
                      fields,                                                                          // 877
                      mutator);                                                                        // 878
  })) {                                                                                                // 879
    throw new Meteor.Error(403, "Access denied");                                                      // 880
  }                                                                                                    // 881
                                                                                                       // 882
  // Back when we supported arbitrary client-provided selectors, we actually                           // 883
  // rewrote the selector to include an _id clause before passing to Mongo to                          // 884
  // avoid races, but since selector is guaranteed to already just be an ID, we                        // 885
  // don't have to any more.                                                                           // 886
                                                                                                       // 887
  return self._collection.update.call(                                                                 // 888
    self._collection, selector, mutator, options);                                                     // 889
};                                                                                                     // 890
                                                                                                       // 891
// Only allow these operations in validated updates. Specifically                                      // 892
// whitelist operations, rather than blacklist, so new complex                                         // 893
// operations that are added aren't automatically allowed. A complex                                   // 894
// operation is one that does more than just modify its target                                         // 895
// field. For now this contains all update operations except '$rename'.                                // 896
// http://docs.mongodb.org/manual/reference/operators/#update                                          // 897
var ALLOWED_UPDATE_OPERATIONS = {                                                                      // 898
  $inc:1, $set:1, $unset:1, $addToSet:1, $pop:1, $pullAll:1, $pull:1,                                  // 899
  $pushAll:1, $push:1, $bit:1                                                                          // 900
};                                                                                                     // 901
                                                                                                       // 902
// Simulate a mongo `remove` operation while validating access control                                 // 903
// rules. See #ValidatedChange                                                                         // 904
Meteor.Collection.prototype._validatedRemove = function(userId, selector) {                            // 905
  var self = this;                                                                                     // 906
                                                                                                       // 907
  var findOptions = {transform: null};                                                                 // 908
  if (!self._validators.fetchAllFields) {                                                              // 909
    findOptions.fields = {};                                                                           // 910
    _.each(self._validators.fetch, function(fieldName) {                                               // 911
      findOptions.fields[fieldName] = 1;                                                               // 912
    });                                                                                                // 913
  }                                                                                                    // 914
                                                                                                       // 915
  var doc = self._collection.findOne(selector, findOptions);                                           // 916
  if (!doc)                                                                                            // 917
    return 0;                                                                                          // 918
                                                                                                       // 919
  // call user validators.                                                                             // 920
  // Any deny returns true means denied.                                                               // 921
  if (_.any(self._validators.remove.deny, function(validator) {                                        // 922
    return validator(userId, transformDoc(validator, doc));                                            // 923
  })) {                                                                                                // 924
    throw new Meteor.Error(403, "Access denied");                                                      // 925
  }                                                                                                    // 926
  // Any allow returns true means proceed. Throw error if they all fail.                               // 927
  if (_.all(self._validators.remove.allow, function(validator) {                                       // 928
    return !validator(userId, transformDoc(validator, doc));                                           // 929
  })) {                                                                                                // 930
    throw new Meteor.Error(403, "Access denied");                                                      // 931
  }                                                                                                    // 932
                                                                                                       // 933
  // Back when we supported arbitrary client-provided selectors, we actually                           // 934
  // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to                       // 935
  // Mongo to avoid races, but since selector is guaranteed to already just be                         // 936
  // an ID, we don't have to any more.                                                                 // 937
                                                                                                       // 938
  return self._collection.remove.call(self._collection, selector);                                     // 939
};                                                                                                     // 940
                                                                                                       // 941
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['mongo-livedata'] = {
  MongoInternals: MongoInternals,
  MongoTest: MongoTest
};

})();
