//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
//                                                                      //
// If you are using Chrome, open the Developer Tools and click the gear //
// icon in its lower right corner. In the General Settings panel, turn  //
// on 'Enable source maps'.                                             //
//                                                                      //
// If you are using Firefox 23, go to `about:config` and set the        //
// `devtools.debugger.source-maps-enabled` preference to true.          //
// (The preference should be on by default in Firefox 24; versions      //
// older than 23 do not support source maps.)                           //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;

/* Package-scope variables */
var Deps;

(function () {

//////////////////////////////////////////////////////////////////////////////////
//                                                                              //
// packages/deps/deps.js                                                        //
//                                                                              //
//////////////////////////////////////////////////////////////////////////////////
                                                                                //
//////////////////////////////////////////////////                              // 1
// Package docs at http://docs.meteor.com/#deps //                              // 2
//////////////////////////////////////////////////                              // 3
                                                                                // 4
Deps = {};                                                                      // 5
                                                                                // 6
// http://docs.meteor.com/#deps_active                                          // 7
Deps.active = false;                                                            // 8
                                                                                // 9
// http://docs.meteor.com/#deps_currentcomputation                              // 10
Deps.currentComputation = null;                                                 // 11
                                                                                // 12
var setCurrentComputation = function (c) {                                      // 13
  Deps.currentComputation = c;                                                  // 14
  Deps.active = !! c;                                                           // 15
};                                                                              // 16
                                                                                // 17
// _assign is like _.extend or the upcoming Object.assign.                      // 18
// Copy src's own, enumerable properties onto tgt and return                    // 19
// tgt.                                                                         // 20
var _hasOwnProperty = Object.prototype.hasOwnProperty;                          // 21
var _assign = function (tgt, src) {                                             // 22
  for (var k in src) {                                                          // 23
    if (_hasOwnProperty.call(src, k))                                           // 24
      tgt[k] = src[k];                                                          // 25
  }                                                                             // 26
  return tgt;                                                                   // 27
};                                                                              // 28
                                                                                // 29
var _debugFunc = function () {                                                  // 30
  // lazy evaluation because `Meteor` does not exist right away                 // 31
  return (typeof Meteor !== "undefined" ? Meteor._debug :                       // 32
          ((typeof console !== "undefined") && console.log ?                    // 33
           function () { console.log.apply(console, arguments); } :             // 34
           function () {}));                                                    // 35
};                                                                              // 36
                                                                                // 37
var _throwOrLog = function (from, e) {                                          // 38
  if (throwFirstError) {                                                        // 39
    throw e;                                                                    // 40
  } else {                                                                      // 41
    _debugFunc()("Exception from Deps " + from + " function:",                  // 42
                 e.stack || e.message);                                         // 43
  }                                                                             // 44
};                                                                              // 45
                                                                                // 46
// Like `Meteor._noYieldsAllowed(function () { f(comp); })` but shorter,        // 47
// and doesn't clutter the stack with an extra frame on the client,             // 48
// where `_noYieldsAllowed` is a no-op.  `f` may be a computation               // 49
// function or an onInvalidate callback.                                        // 50
var callWithNoYieldsAllowed = function (f, comp) {                              // 51
  if ((typeof Meteor === 'undefined') || Meteor.isClient) {                     // 52
    f(comp);                                                                    // 53
  } else {                                                                      // 54
    Meteor._noYieldsAllowed(function () {                                       // 55
      f(comp);                                                                  // 56
    });                                                                         // 57
  }                                                                             // 58
};                                                                              // 59
                                                                                // 60
var nextId = 1;                                                                 // 61
// computations whose callbacks we should call at flush time                    // 62
var pendingComputations = [];                                                   // 63
// `true` if a Deps.flush is scheduled, or if we are in Deps.flush now          // 64
var willFlush = false;                                                          // 65
// `true` if we are in Deps.flush now                                           // 66
var inFlush = false;                                                            // 67
// `true` if we are computing a computation now, either first time              // 68
// or recompute.  This matches Deps.active unless we are inside                 // 69
// Deps.nonreactive, which nullfies currentComputation even though              // 70
// an enclosing computation may still be running.                               // 71
var inCompute = false;                                                          // 72
// `true` if the `_throwFirstError` option was passed in to the call            // 73
// to Deps.flush that we are in. When set, throw rather than log the            // 74
// first error encountered while flushing. Before throwing the error,           // 75
// finish flushing (from a finally block), logging any subsequent               // 76
// errors.                                                                      // 77
var throwFirstError = false;                                                    // 78
                                                                                // 79
var afterFlushCallbacks = [];                                                   // 80
                                                                                // 81
var requireFlush = function () {                                                // 82
  if (! willFlush) {                                                            // 83
    setTimeout(Deps.flush, 0);                                                  // 84
    willFlush = true;                                                           // 85
  }                                                                             // 86
};                                                                              // 87
                                                                                // 88
// Deps.Computation constructor is visible but private                          // 89
// (throws an error if you try to call it)                                      // 90
var constructingComputation = false;                                            // 91
                                                                                // 92
//                                                                              // 93
// http://docs.meteor.com/#deps_computation                                     // 94
//                                                                              // 95
Deps.Computation = function (f, parent) {                                       // 96
  if (! constructingComputation)                                                // 97
    throw new Error(                                                            // 98
      "Deps.Computation constructor is private; use Deps.autorun");             // 99
  constructingComputation = false;                                              // 100
                                                                                // 101
  var self = this;                                                              // 102
                                                                                // 103
  // http://docs.meteor.com/#computation_stopped                                // 104
  self.stopped = false;                                                         // 105
                                                                                // 106
  // http://docs.meteor.com/#computation_invalidated                            // 107
  self.invalidated = false;                                                     // 108
                                                                                // 109
  // http://docs.meteor.com/#computation_firstrun                               // 110
  self.firstRun = true;                                                         // 111
                                                                                // 112
  self._id = nextId++;                                                          // 113
  self._onInvalidateCallbacks = [];                                             // 114
  // the plan is at some point to use the parent relation                       // 115
  // to constrain the order that computations are processed                     // 116
  self._parent = parent;                                                        // 117
  self._func = f;                                                               // 118
  self._recomputing = false;                                                    // 119
                                                                                // 120
  var errored = true;                                                           // 121
  try {                                                                         // 122
    self._compute();                                                            // 123
    errored = false;                                                            // 124
  } finally {                                                                   // 125
    self.firstRun = false;                                                      // 126
    if (errored)                                                                // 127
      self.stop();                                                              // 128
  }                                                                             // 129
};                                                                              // 130
                                                                                // 131
_assign(Deps.Computation.prototype, {                                           // 132
                                                                                // 133
  // http://docs.meteor.com/#computation_oninvalidate                           // 134
  onInvalidate: function (f) {                                                  // 135
    var self = this;                                                            // 136
                                                                                // 137
    if (typeof f !== 'function')                                                // 138
      throw new Error("onInvalidate requires a function");                      // 139
                                                                                // 140
    if (self.invalidated) {                                                     // 141
      Deps.nonreactive(function () {                                            // 142
        callWithNoYieldsAllowed(f, self);                                       // 143
      });                                                                       // 144
    } else {                                                                    // 145
      self._onInvalidateCallbacks.push(f);                                      // 146
    }                                                                           // 147
  },                                                                            // 148
                                                                                // 149
  // http://docs.meteor.com/#computation_invalidate                             // 150
  invalidate: function () {                                                     // 151
    var self = this;                                                            // 152
    if (! self.invalidated) {                                                   // 153
      // if we're currently in _recompute(), don't enqueue                      // 154
      // ourselves, since we'll rerun immediately anyway.                       // 155
      if (! self._recomputing && ! self.stopped) {                              // 156
        requireFlush();                                                         // 157
        pendingComputations.push(this);                                         // 158
      }                                                                         // 159
                                                                                // 160
      self.invalidated = true;                                                  // 161
                                                                                // 162
      // callbacks can't add callbacks, because                                 // 163
      // self.invalidated === true.                                             // 164
      for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++) {              // 165
        Deps.nonreactive(function () {                                          // 166
          callWithNoYieldsAllowed(f, self);                                     // 167
        });                                                                     // 168
      }                                                                         // 169
      self._onInvalidateCallbacks = [];                                         // 170
    }                                                                           // 171
  },                                                                            // 172
                                                                                // 173
  // http://docs.meteor.com/#computation_stop                                   // 174
  stop: function () {                                                           // 175
    if (! this.stopped) {                                                       // 176
      this.stopped = true;                                                      // 177
      this.invalidate();                                                        // 178
    }                                                                           // 179
  },                                                                            // 180
                                                                                // 181
  _compute: function () {                                                       // 182
    var self = this;                                                            // 183
    self.invalidated = false;                                                   // 184
                                                                                // 185
    var previous = Deps.currentComputation;                                     // 186
    setCurrentComputation(self);                                                // 187
    var previousInCompute = inCompute;                                          // 188
    inCompute = true;                                                           // 189
    try {                                                                       // 190
      callWithNoYieldsAllowed(self._func, self);                                // 191
    } finally {                                                                 // 192
      setCurrentComputation(previous);                                          // 193
      inCompute = false;                                                        // 194
    }                                                                           // 195
  },                                                                            // 196
                                                                                // 197
  _recompute: function () {                                                     // 198
    var self = this;                                                            // 199
                                                                                // 200
    self._recomputing = true;                                                   // 201
    try {                                                                       // 202
      while (self.invalidated && ! self.stopped) {                              // 203
        try {                                                                   // 204
          self._compute();                                                      // 205
        } catch (e) {                                                           // 206
          _throwOrLog("recompute", e);                                          // 207
        }                                                                       // 208
        // If _compute() invalidated us, we run again immediately.              // 209
        // A computation that invalidates itself indefinitely is an             // 210
        // infinite loop, of course.                                            // 211
        //                                                                      // 212
        // We could put an iteration counter here and catch run-away            // 213
        // loops.                                                               // 214
      }                                                                         // 215
    } finally {                                                                 // 216
      self._recomputing = false;                                                // 217
    }                                                                           // 218
  }                                                                             // 219
});                                                                             // 220
                                                                                // 221
//                                                                              // 222
// http://docs.meteor.com/#deps_dependency                                      // 223
//                                                                              // 224
Deps.Dependency = function () {                                                 // 225
  this._dependentsById = {};                                                    // 226
};                                                                              // 227
                                                                                // 228
_assign(Deps.Dependency.prototype, {                                            // 229
  // http://docs.meteor.com/#dependency_depend                                  // 230
  //                                                                            // 231
  // Adds `computation` to this set if it is not already                        // 232
  // present.  Returns true if `computation` is a new member of the set.        // 233
  // If no argument, defaults to currentComputation, or does nothing            // 234
  // if there is no currentComputation.                                         // 235
  depend: function (computation) {                                              // 236
    if (! computation) {                                                        // 237
      if (! Deps.active)                                                        // 238
        return false;                                                           // 239
                                                                                // 240
      computation = Deps.currentComputation;                                    // 241
    }                                                                           // 242
    var self = this;                                                            // 243
    var id = computation._id;                                                   // 244
    if (! (id in self._dependentsById)) {                                       // 245
      self._dependentsById[id] = computation;                                   // 246
      computation.onInvalidate(function () {                                    // 247
        delete self._dependentsById[id];                                        // 248
      });                                                                       // 249
      return true;                                                              // 250
    }                                                                           // 251
    return false;                                                               // 252
  },                                                                            // 253
                                                                                // 254
  // http://docs.meteor.com/#dependency_changed                                 // 255
  changed: function () {                                                        // 256
    var self = this;                                                            // 257
    for (var id in self._dependentsById)                                        // 258
      self._dependentsById[id].invalidate();                                    // 259
  },                                                                            // 260
                                                                                // 261
  // http://docs.meteor.com/#dependency_hasdependents                           // 262
  hasDependents: function () {                                                  // 263
    var self = this;                                                            // 264
    for(var id in self._dependentsById)                                         // 265
      return true;                                                              // 266
    return false;                                                               // 267
  }                                                                             // 268
});                                                                             // 269
                                                                                // 270
_assign(Deps, {                                                                 // 271
  // http://docs.meteor.com/#deps_flush                                         // 272
  flush: function (_opts) {                                                     // 273
    // XXX What part of the comment below is still true? (We no longer          // 274
    // have Spark)                                                              // 275
    //                                                                          // 276
    // Nested flush could plausibly happen if, say, a flush causes              // 277
    // DOM mutation, which causes a "blur" event, which runs an                 // 278
    // app event handler that calls Deps.flush.  At the moment                  // 279
    // Spark blocks event handlers during DOM mutation anyway,                  // 280
    // because the LiveRange tree isn't valid.  And we don't have               // 281
    // any useful notion of a nested flush.                                     // 282
    //                                                                          // 283
    // https://app.asana.com/0/159908330244/385138233856                        // 284
    if (inFlush)                                                                // 285
      throw new Error("Can't call Deps.flush while flushing");                  // 286
                                                                                // 287
    if (inCompute)                                                              // 288
      throw new Error("Can't flush inside Deps.autorun");                       // 289
                                                                                // 290
    inFlush = true;                                                             // 291
    willFlush = true;                                                           // 292
    throwFirstError = !! (_opts && _opts._throwFirstError);                     // 293
                                                                                // 294
    var finishedTry = false;                                                    // 295
    try {                                                                       // 296
      while (pendingComputations.length ||                                      // 297
             afterFlushCallbacks.length) {                                      // 298
                                                                                // 299
        // recompute all pending computations                                   // 300
        while (pendingComputations.length) {                                    // 301
          var comp = pendingComputations.shift();                               // 302
          comp._recompute();                                                    // 303
        }                                                                       // 304
                                                                                // 305
        if (afterFlushCallbacks.length) {                                       // 306
          // call one afterFlush callback, which may                            // 307
          // invalidate more computations                                       // 308
          var func = afterFlushCallbacks.shift();                               // 309
          try {                                                                 // 310
            func();                                                             // 311
          } catch (e) {                                                         // 312
            _throwOrLog("afterFlush function", e);                              // 313
          }                                                                     // 314
        }                                                                       // 315
      }                                                                         // 316
      finishedTry = true;                                                       // 317
    } finally {                                                                 // 318
      if (! finishedTry) {                                                      // 319
        // we're erroring                                                       // 320
        inFlush = false; // needed before calling `Deps.flush()` again          // 321
        Deps.flush({_throwFirstError: false}); // finish flushing               // 322
      }                                                                         // 323
      willFlush = false;                                                        // 324
      inFlush = false;                                                          // 325
    }                                                                           // 326
  },                                                                            // 327
                                                                                // 328
  // http://docs.meteor.com/#deps_autorun                                       // 329
  //                                                                            // 330
  // Run f(). Record its dependencies. Rerun it whenever the                    // 331
  // dependencies change.                                                       // 332
  //                                                                            // 333
  // Returns a new Computation, which is also passed to f.                      // 334
  //                                                                            // 335
  // Links the computation to the current computation                           // 336
  // so that it is stopped if the current computation is invalidated.           // 337
  autorun: function (f) {                                                       // 338
    if (typeof f !== 'function')                                                // 339
      throw new Error('Deps.autorun requires a function argument');             // 340
                                                                                // 341
    constructingComputation = true;                                             // 342
    var c = new Deps.Computation(f, Deps.currentComputation);                   // 343
                                                                                // 344
    if (Deps.active)                                                            // 345
      Deps.onInvalidate(function () {                                           // 346
        c.stop();                                                               // 347
      });                                                                       // 348
                                                                                // 349
    return c;                                                                   // 350
  },                                                                            // 351
                                                                                // 352
  // http://docs.meteor.com/#deps_nonreactive                                   // 353
  //                                                                            // 354
  // Run `f` with no current computation, returning the return value            // 355
  // of `f`.  Used to turn off reactivity for the duration of `f`,              // 356
  // so that reactive data sources accessed by `f` will not result in any       // 357
  // computations being invalidated.                                            // 358
  nonreactive: function (f) {                                                   // 359
    var previous = Deps.currentComputation;                                     // 360
    setCurrentComputation(null);                                                // 361
    try {                                                                       // 362
      return f();                                                               // 363
    } finally {                                                                 // 364
      setCurrentComputation(previous);                                          // 365
    }                                                                           // 366
  },                                                                            // 367
                                                                                // 368
  // http://docs.meteor.com/#deps_oninvalidate                                  // 369
  onInvalidate: function (f) {                                                  // 370
    if (! Deps.active)                                                          // 371
      throw new Error("Deps.onInvalidate requires a currentComputation");       // 372
                                                                                // 373
    Deps.currentComputation.onInvalidate(f);                                    // 374
  },                                                                            // 375
                                                                                // 376
  // http://docs.meteor.com/#deps_afterflush                                    // 377
  afterFlush: function (f) {                                                    // 378
    afterFlushCallbacks.push(f);                                                // 379
    requireFlush();                                                             // 380
  }                                                                             // 381
});                                                                             // 382
                                                                                // 383
//////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////
//                                                                              //
// packages/deps/deprecated.js                                                  //
//                                                                              //
//////////////////////////////////////////////////////////////////////////////////
                                                                                //
// Deprecated (Deps-recated?) functions.                                        // 1
                                                                                // 2
// These functions used to be on the Meteor object (and worked slightly         // 3
// differently).                                                                // 4
// XXX COMPAT WITH 0.5.7                                                        // 5
Meteor.flush = Deps.flush;                                                      // 6
Meteor.autorun = Deps.autorun;                                                  // 7
                                                                                // 8
// We used to require a special "autosubscribe" call to reactively subscribe to // 9
// things. Now, it works with autorun.                                          // 10
// XXX COMPAT WITH 0.5.4                                                        // 11
Meteor.autosubscribe = Deps.autorun;                                            // 12
                                                                                // 13
// This Deps API briefly existed in 0.5.8 and 0.5.9                             // 14
// XXX COMPAT WITH 0.5.9                                                        // 15
Deps.depend = function (d) {                                                    // 16
  return d.depend();                                                            // 17
};                                                                              // 18
                                                                                // 19
//////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.deps = {
  Deps: Deps
};

})();

//# sourceMappingURL=91f1235baecd83915f7d3a7328526dbba41482be.map
