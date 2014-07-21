(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Deps = Package.deps.Deps;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var ObserveSequence = Package['observe-sequence'].ObserveSequence;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var UI, Handlebars, reportUIException, _extend, Component, findComponentWithProp, findComponentWithHelper, getComponentData, updateTemplateInstance, AttributeHandler, makeAttributeHandler, ElementAttributesUpdater;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/exceptions.js                                                                            //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
var debugFunc;                                                                                          // 2
                                                                                                        // 3
// Meteor UI calls into user code in many places, and it's nice to catch exceptions                     // 4
// propagated from user code immediately so that the whole system doesn't just                          // 5
// break.  Catching exceptions is easy; reporting them is hard.  This helper                            // 6
// reports exceptions.                                                                                  // 7
//                                                                                                      // 8
// Usage:                                                                                               // 9
//                                                                                                      // 10
// ```                                                                                                  // 11
// try {                                                                                                // 12
//   // ... someStuff ...                                                                               // 13
// } catch (e) {                                                                                        // 14
//   reportUIException(e);                                                                              // 15
// }                                                                                                    // 16
// ```                                                                                                  // 17
//                                                                                                      // 18
// An optional second argument overrides the default message.                                           // 19
                                                                                                        // 20
reportUIException = function (e, msg) {                                                                 // 21
  if (! debugFunc)                                                                                      // 22
    // adapted from Deps                                                                                // 23
    debugFunc = function () {                                                                           // 24
      return (typeof Meteor !== "undefined" ? Meteor._debug :                                           // 25
              ((typeof console !== "undefined") && console.log ? console.log :                          // 26
               function () {}));                                                                        // 27
    };                                                                                                  // 28
                                                                                                        // 29
  // In Chrome, `e.stack` is a multiline string that starts with the message                            // 30
  // and contains a stack trace.  Furthermore, `console.log` makes it clickable.                        // 31
  // `console.log` supplies the space between the two arguments.                                        // 32
  debugFunc()(msg || 'Exception in Meteor UI:', e.stack || e.message);                                  // 33
};                                                                                                      // 34
                                                                                                        // 35
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/base.js                                                                                  //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
UI = {};                                                                                                // 1
                                                                                                        // 2
// A very basic operation like Underscore's `_.extend` that                                             // 3
// copies `src`'s own, enumerable properties onto `tgt` and                                             // 4
// returns `tgt`.                                                                                       // 5
_extend = function (tgt, src) {                                                                         // 6
  for (var k in src)                                                                                    // 7
    if (src.hasOwnProperty(k))                                                                          // 8
      tgt[k] = src[k];                                                                                  // 9
  return tgt;                                                                                           // 10
};                                                                                                      // 11
                                                                                                        // 12
// Defines a single non-enumerable, read-only property                                                  // 13
// on `tgt`.                                                                                            // 14
// It won't be non-enumerable in IE 8, so its                                                           // 15
// non-enumerability can't be relied on for logic                                                       // 16
// purposes, it just makes things prettier in                                                           // 17
// the dev console.                                                                                     // 18
var _defineNonEnum = function (tgt, name, value) {                                                      // 19
  try {                                                                                                 // 20
    Object.defineProperty(tgt, name, {value: value});                                                   // 21
  } catch (e) {                                                                                         // 22
    // IE < 9                                                                                           // 23
    tgt[name] = value;                                                                                  // 24
  }                                                                                                     // 25
  return tgt;                                                                                           // 26
};                                                                                                      // 27
                                                                                                        // 28
// Named function (like `function Component() {}` below) make                                           // 29
// inspection in debuggers more descriptive. In IE, this sets the                                       // 30
// value of the `Component` var in the function scope in which it's                                     // 31
// executed. We already have a top-level `Component` var so we create                                   // 32
// a new function scope to not write it over in IE.                                                     // 33
(function () {                                                                                          // 34
                                                                                                        // 35
  // Components and Component kinds are the same thing, just                                            // 36
  // objects; there are no constructor functions, no `new`,                                             // 37
  // and no `instanceof`.  A Component object is like a class,                                          // 38
  // until it is inited, at which point it becomes more like                                            // 39
  // an instance.                                                                                       // 40
  //                                                                                                    // 41
  // `y = x.extend({ ...new props })` creates a new Component                                           // 42
  // `y` with `x` as its prototype, plus additional properties                                          // 43
  // on `y` itself.  `extend` is used both to subclass and to                                           // 44
  // create instances (and the hope is we can gloss over the                                            // 45
  // difference in the docs).                                                                           // 46
  UI.Component = (function (constr) {                                                                   // 47
                                                                                                        // 48
    // Make sure the "class name" that Chrome infers for                                                // 49
    // UI.Component is "Component", and that                                                            // 50
    // `new UI.Component._constr` (which is what `extend`                                               // 51
    // does) also produces objects whose inferred class                                                 // 52
    // name is "Component".  Chrome's name inference rules                                              // 53
    // are a little mysterious, but a function name in                                                  // 54
    // the source code (as in `function Component() {}`)                                                // 55
    // seems to be reliable and high precedence.                                                        // 56
    var C = new constr;                                                                                 // 57
    _defineNonEnum(C, '_constr', constr);                                                               // 58
    _defineNonEnum(C, '_super', null);                                                                  // 59
    return C;                                                                                           // 60
  })(function Component() {});                                                                          // 61
})();                                                                                                   // 62
                                                                                                        // 63
_extend(UI, {                                                                                           // 64
  nextGuid: 2, // Component is 1!                                                                       // 65
                                                                                                        // 66
  isComponent: function (obj) {                                                                         // 67
    return obj && UI.isKindOf(obj, UI.Component);                                                       // 68
  },                                                                                                    // 69
  // `UI.isKindOf(a, b)` where `a` and `b` are Components                                               // 70
  // (or kinds) asks if `a` is or descends from                                                         // 71
  // (transitively extends) `b`.                                                                        // 72
  isKindOf: function (a, b) {                                                                           // 73
    while (a) {                                                                                         // 74
      if (a === b)                                                                                      // 75
        return true;                                                                                    // 76
      a = a._super;                                                                                     // 77
    }                                                                                                   // 78
    return false;                                                                                       // 79
  },                                                                                                    // 80
  // use these to produce error messages for developers                                                 // 81
  // (though throwing a more specific error message is                                                  // 82
  // even better)                                                                                       // 83
  _requireNotDestroyed: function (c) {                                                                  // 84
    if (c.isDestroyed)                                                                                  // 85
      throw new Error("Component has been destroyed; can't perform this operation");                    // 86
  },                                                                                                    // 87
  _requireInited: function (c) {                                                                        // 88
    if (! c.isInited)                                                                                   // 89
      throw new Error("Component must be inited to perform this operation");                            // 90
  },                                                                                                    // 91
  _requireDom: function (c) {                                                                           // 92
    if (! c.dom)                                                                                        // 93
      throw new Error("Component must be built into DOM to perform this operation");                    // 94
  }                                                                                                     // 95
});                                                                                                     // 96
                                                                                                        // 97
Component = UI.Component;                                                                               // 98
                                                                                                        // 99
_extend(UI.Component, {                                                                                 // 100
  kind: "Component",                                                                                    // 101
  guid: "1",                                                                                            // 102
  dom: null,                                                                                            // 103
  // Has this Component ever been inited?                                                               // 104
  isInited: false,                                                                                      // 105
  // Has this Component been destroyed?  Only inited Components                                         // 106
  // can be destroyed.                                                                                  // 107
  isDestroyed: false,                                                                                   // 108
  // Component that created this component (typically also                                              // 109
  // the DOM containment parent).                                                                       // 110
  // No child pointers (except in `dom`).                                                               // 111
  parent: null,                                                                                         // 112
                                                                                                        // 113
  // create a new subkind or instance whose proto pointer                                               // 114
  // points to this, with additional props set.                                                         // 115
  extend: function (props) {                                                                            // 116
    // this function should never cause `props` to be                                                   // 117
    // mutated in case people want to reuse `props` objects                                             // 118
    // in a mixin-like way.                                                                             // 119
                                                                                                        // 120
    if (this.isInited)                                                                                  // 121
      // Disallow extending inited Components so that                                                   // 122
      // inited Components don't inherit instance-specific                                              // 123
      // properties from other inited Components, just                                                  // 124
      // default values.                                                                                // 125
      throw new Error("Can't extend an inited Component");                                              // 126
                                                                                                        // 127
    var constr;                                                                                         // 128
    var constrMade = false;                                                                             // 129
    if (props && props.kind) {                                                                          // 130
      // If `kind` is different from super, set a constructor.                                          // 131
      // We used to set the function name here so that components                                       // 132
      // printed better in the console, but we took it out because                                      // 133
      // of CSP (and in hopes that Chrome finally adds proper                                           // 134
      // displayName support).                                                                          // 135
      constr = function () {};                                                                          // 136
      constrMade = true;                                                                                // 137
    } else {                                                                                            // 138
      constr = this._constr;                                                                            // 139
    }                                                                                                   // 140
                                                                                                        // 141
    // We don't know where we're getting `constr` from --                                               // 142
    // it might be from some supertype -- just that it has                                              // 143
    // the right function name.  So set the `prototype`                                                 // 144
    // property each time we use it as a constructor.                                                   // 145
    constr.prototype = this;                                                                            // 146
                                                                                                        // 147
    var c = new constr;                                                                                 // 148
    if (constrMade)                                                                                     // 149
      c._constr = constr;                                                                               // 150
                                                                                                        // 151
    if (props)                                                                                          // 152
      _extend(c, props);                                                                                // 153
                                                                                                        // 154
    // for efficient Component instantiations, we assign                                                // 155
    // as few things as possible here.                                                                  // 156
    _defineNonEnum(c, '_super', this);                                                                  // 157
    c.guid = String(UI.nextGuid++);                                                                     // 158
                                                                                                        // 159
    return c;                                                                                           // 160
  }                                                                                                     // 161
});                                                                                                     // 162
                                                                                                        // 163
//callChainedCallback = function (comp, propName, orig) {                                               // 164
  // Call `comp.foo`, `comp._super.foo`,                                                                // 165
  // `comp._super._super.foo`, and so on, but in reverse                                                // 166
  // order, and only if `foo` is an "own property" in each                                              // 167
  // case.  Furthermore, the passed value of `this` should                                              // 168
  // remain `comp` for all calls (which is achieved by                                                  // 169
  // filling in `orig` when recursing).                                                                 // 170
//  if (comp._super)                                                                                    // 171
//    callChainedCallback(comp._super, propName, orig || comp);                                         // 172
//                                                                                                      // 173
//  if (comp.hasOwnProperty(propName))                                                                  // 174
//    comp[propName].call(orig || comp);                                                                // 175
//};                                                                                                    // 176
                                                                                                        // 177
                                                                                                        // 178
// Returns 0 if the nodes are the same or either one contains the other;                                // 179
// otherwise, -1 if a comes before b, or else 1 if b comes before a in                                  // 180
// document order.                                                                                      // 181
// Requires: `a` and `b` are element nodes in the same document tree.                                   // 182
var compareElementIndex = function (a, b) {                                                             // 183
  // See http://ejohn.org/blog/comparing-document-position/                                             // 184
  if (a === b)                                                                                          // 185
    return 0;                                                                                           // 186
  if (a.compareDocumentPosition) {                                                                      // 187
    var n = a.compareDocumentPosition(b);                                                               // 188
    return ((n & 0x18) ? 0 : ((n & 0x4) ? -1 : 1));                                                     // 189
  } else {                                                                                              // 190
    // Only old IE is known to not have compareDocumentPosition (though Safari                          // 191
    // originally lacked it).  Thankfully, IE gives us a way of comparing elements                      // 192
    // via the "sourceIndex" property.                                                                  // 193
    if (a.contains(b) || b.contains(a))                                                                 // 194
      return 0;                                                                                         // 195
    return (a.sourceIndex < b.sourceIndex ? -1 : 1);                                                    // 196
  }                                                                                                     // 197
};                                                                                                      // 198
                                                                                                        // 199
findComponentWithProp = function (id, comp) {                                                           // 200
  while (comp) {                                                                                        // 201
    if (typeof comp[id] !== 'undefined')                                                                // 202
      return comp;                                                                                      // 203
    comp = comp.parent;                                                                                 // 204
  }                                                                                                     // 205
  return null;                                                                                          // 206
};                                                                                                      // 207
                                                                                                        // 208
findComponentWithHelper = function (id, comp) {                                                         // 209
  while (comp) {                                                                                        // 210
    if (comp.__helperHost) {                                                                            // 211
      if (typeof comp[id] !== 'undefined')                                                              // 212
        return comp;                                                                                    // 213
      else                                                                                              // 214
        return null;                                                                                    // 215
    }                                                                                                   // 216
    comp = comp.parent;                                                                                 // 217
  }                                                                                                     // 218
  return null;                                                                                          // 219
};                                                                                                      // 220
                                                                                                        // 221
getComponentData = function (comp) {                                                                    // 222
  comp = findComponentWithProp('data', comp);                                                           // 223
  return (comp ?                                                                                        // 224
          (typeof comp.data === 'function' ?                                                            // 225
           comp.data() : comp.data) :                                                                   // 226
          null);                                                                                        // 227
};                                                                                                      // 228
                                                                                                        // 229
updateTemplateInstance = function (comp) {                                                              // 230
  // Populate `comp.templateInstance.{firstNode,lastNode,data}`                                         // 231
  // on demand.                                                                                         // 232
  var tmpl = comp.templateInstance;                                                                     // 233
  tmpl.data = getComponentData(comp);                                                                   // 234
                                                                                                        // 235
  if (comp.dom && !comp.isDestroyed) {                                                                  // 236
    tmpl.firstNode = comp.dom.startNode().nextSibling;                                                  // 237
    tmpl.lastNode = comp.dom.endNode().previousSibling;                                                 // 238
    // Catch the case where the DomRange is empty and we'd                                              // 239
    // otherwise pass the out-of-order nodes (end, start)                                               // 240
    // as (firstNode, lastNode).                                                                        // 241
    if (tmpl.lastNode && tmpl.lastNode.nextSibling === tmpl.firstNode)                                  // 242
      tmpl.lastNode = tmpl.firstNode;                                                                   // 243
  } else {                                                                                              // 244
    // on 'created' or 'destroyed' callbacks we don't have a DomRange                                   // 245
    tmpl.firstNode = null;                                                                              // 246
    tmpl.lastNode = null;                                                                               // 247
  }                                                                                                     // 248
};                                                                                                      // 249
                                                                                                        // 250
_extend(UI.Component, {                                                                                 // 251
  // We implement the old APIs here, including how data is passed                                       // 252
  // to helpers in `this`.                                                                              // 253
  helpers: function (dict) {                                                                            // 254
    _extend(this, dict);                                                                                // 255
  },                                                                                                    // 256
  events: function (dict) {                                                                             // 257
    var events;                                                                                         // 258
    if (this.hasOwnProperty('_events'))                                                                 // 259
      events = this._events;                                                                            // 260
    else                                                                                                // 261
      events = (this._events = []);                                                                     // 262
                                                                                                        // 263
    _.each(dict, function (handler, spec) {                                                             // 264
      var clauses = spec.split(/,\s+/);                                                                 // 265
      // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']                                // 266
      _.each(clauses, function (clause) {                                                               // 267
        var parts = clause.split(/\s+/);                                                                // 268
        if (parts.length === 0)                                                                         // 269
          return;                                                                                       // 270
                                                                                                        // 271
        var newEvents = parts.shift();                                                                  // 272
        var selector = parts.join(' ');                                                                 // 273
        events.push({events: newEvents,                                                                 // 274
                     selector: selector,                                                                // 275
                     handler: handler});                                                                // 276
      });                                                                                               // 277
    });                                                                                                 // 278
  }                                                                                                     // 279
});                                                                                                     // 280
                                                                                                        // 281
// XXX we don't really want this to be a user-visible callback,                                         // 282
// it's just a particular signal we need from DomRange.                                                 // 283
UI.Component.notifyParented = function () {                                                             // 284
  var self = this;                                                                                      // 285
  for (var comp = self; comp; comp = comp._super) {                                                     // 286
    var events = (comp.hasOwnProperty('_events') && comp._events) || null;                              // 287
    if ((! events) && comp.hasOwnProperty('events') &&                                                  // 288
        typeof comp.events === 'object') {                                                              // 289
      // Provide limited back-compat support for `.events = {...}`                                      // 290
      // syntax.  Pass `comp.events` to the original `.events(...)`                                     // 291
      // function.  This code must run only once per component, in                                      // 292
      // order to not bind the handlers more than once, which is                                        // 293
      // ensured by the fact that we only do this when `comp._events`                                   // 294
      // is falsy, and we cause it to be set now.                                                       // 295
      UI.Component.events.call(comp, comp.events);                                                      // 296
      events = comp._events;                                                                            // 297
    }                                                                                                   // 298
    _.each(events, function (esh) { // {events, selector, handler}                                      // 299
      // wrap the handler here, per instance of the template that                                       // 300
      // declares the event map, so we can pass the instance to                                         // 301
      // the event handler.                                                                             // 302
      var wrappedHandler = function (event) {                                                           // 303
        var comp = UI.DomRange.getContainingComponent(event.currentTarget);                             // 304
        var data = comp && getComponentData(comp);                                                      // 305
        var args = _.toArray(arguments);                                                                // 306
        updateTemplateInstance(self);                                                                   // 307
        return Deps.nonreactive(function () {                                                           // 308
          // put self.templateInstance as the second argument                                           // 309
          args.splice(1, 0, self.templateInstance);                                                     // 310
          // Don't want to be in a deps context, even if we were somehow                                // 311
          // triggered synchronously in an existing deps context                                        // 312
          // (the `blur` event can do this).                                                            // 313
          // XXX we should probably do what Spark did and block all                                     // 314
          // event handling during our DOM manip.  Many apps had weird                                  // 315
          // unanticipated bugs until we did that.                                                      // 316
          return esh.handler.apply(data === null ? {} : data, args);                                    // 317
        });                                                                                             // 318
      };                                                                                                // 319
                                                                                                        // 320
      self.dom.on(esh.events, esh.selector, wrappedHandler);                                            // 321
    });                                                                                                 // 322
  }                                                                                                     // 323
                                                                                                        // 324
  if (self.rendered) {                                                                                  // 325
    // Defer rendered callback until flush time.                                                        // 326
    Deps.afterFlush(function () {                                                                       // 327
      if (! self.isDestroyed) {                                                                         // 328
        updateTemplateInstance(self);                                                                   // 329
        self.rendered.call(self.templateInstance);                                                      // 330
      }                                                                                                 // 331
    });                                                                                                 // 332
  }                                                                                                     // 333
};                                                                                                      // 334
                                                                                                        // 335
// past compat                                                                                          // 336
UI.Component.preserve = function () {                                                                   // 337
  Meteor._debug("The 'preserve' method on templates is now unnecessary and deprecated.");               // 338
};                                                                                                      // 339
                                                                                                        // 340
// Gets the data context of the enclosing component that rendered a                                     // 341
// given element                                                                                        // 342
UI.getElementData = function (el) {                                                                     // 343
  var comp = UI.DomRange.getContainingComponent(el);                                                    // 344
  return comp && getComponentData(comp);                                                                // 345
};                                                                                                      // 346
                                                                                                        // 347
var jsUrlsAllowed = false;                                                                              // 348
UI._allowJavascriptUrls = function () {                                                                 // 349
  jsUrlsAllowed = true;                                                                                 // 350
};                                                                                                      // 351
UI._javascriptUrlsAllowed = function () {                                                               // 352
  return jsUrlsAllowed;                                                                                 // 353
};                                                                                                      // 354
                                                                                                        // 355
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/attrs.js                                                                                 //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
// An AttributeHandler object is responsible for updating a particular attribute                        // 2
// of a particular element.  AttributeHandler subclasses implement                                      // 3
// browser-specific logic for dealing with particular attributes across                                 // 4
// different browsers.                                                                                  // 5
//                                                                                                      // 6
// To define a new type of AttributeHandler, use                                                        // 7
// `var FooHandler = AttributeHandler.extend({ update: function ... })`                                 // 8
// where the `update` function takes arguments `(element, oldValue, value)`.                            // 9
// The `element` argument is always the same between calls to `update` on                               // 10
// the same instance.  `oldValue` and `value` are each either `null` or                                 // 11
// a Unicode string of the type that might be passed to the value argument                              // 12
// of `setAttribute` (i.e. not an HTML string with character references).                               // 13
// When an AttributeHandler is installed, an initial call to `update` is                                // 14
// always made with `oldValue = null`.  The `update` method can access                                  // 15
// `this.name` if the AttributeHandler class is a generic one that applies                              // 16
// to multiple attribute names.                                                                         // 17
//                                                                                                      // 18
// AttributeHandlers can store custom properties on `this`, as long as they                             // 19
// don't use the names `element`, `name`, `value`, and `oldValue`.                                      // 20
//                                                                                                      // 21
// AttributeHandlers can't influence how attributes appear in rendered HTML,                            // 22
// only how they are updated after materialization as DOM.                                              // 23
                                                                                                        // 24
AttributeHandler = function (name, value) {                                                             // 25
  this.name = name;                                                                                     // 26
  this.value = value;                                                                                   // 27
};                                                                                                      // 28
                                                                                                        // 29
AttributeHandler.prototype.update = function (element, oldValue, value) {                               // 30
  if (value === null) {                                                                                 // 31
    if (oldValue !== null)                                                                              // 32
      element.removeAttribute(this.name);                                                               // 33
  } else {                                                                                              // 34
    element.setAttribute(this.name, value);                                                             // 35
  }                                                                                                     // 36
};                                                                                                      // 37
                                                                                                        // 38
AttributeHandler.extend = function (options) {                                                          // 39
  var curType = this;                                                                                   // 40
  var subType = function AttributeHandlerSubtype(/*arguments*/) {                                       // 41
    AttributeHandler.apply(this, arguments);                                                            // 42
  };                                                                                                    // 43
  subType.prototype = new curType;                                                                      // 44
  subType.extend = curType.extend;                                                                      // 45
  if (options)                                                                                          // 46
    _.extend(subType.prototype, options);                                                               // 47
  return subType;                                                                                       // 48
};                                                                                                      // 49
                                                                                                        // 50
// Extended below to support both regular and SVG elements                                              // 51
var BaseClassHandler = AttributeHandler.extend({                                                        // 52
  update: function (element, oldValue, value) {                                                         // 53
    if (!this.getCurrentValue || !this.setValue)                                                        // 54
      throw new Error("Missing methods in subclass of 'BaseClassHandler'");                             // 55
                                                                                                        // 56
    var oldClasses = oldValue ? _.compact(oldValue.split(' ')) : [];                                    // 57
    var newClasses = value ? _.compact(value.split(' ')) : [];                                          // 58
                                                                                                        // 59
    // the current classes on the element, which we will mutate.                                        // 60
    var classes = _.compact(this.getCurrentValue(element).split(' '));                                  // 61
                                                                                                        // 62
    // optimize this later (to be asymptotically faster) if necessary                                   // 63
    for (var i = 0; i < oldClasses.length; i++) {                                                       // 64
      var c = oldClasses[i];                                                                            // 65
      if (! _.contains(newClasses, c))                                                                  // 66
        classes = _.without(classes, c);                                                                // 67
    }                                                                                                   // 68
    for (var i = 0; i < newClasses.length; i++) {                                                       // 69
      var c = newClasses[i];                                                                            // 70
      if ((! _.contains(oldClasses, c)) &&                                                              // 71
          (! _.contains(classes, c)))                                                                   // 72
        classes.push(c);                                                                                // 73
    }                                                                                                   // 74
                                                                                                        // 75
    this.setValue(element, classes.join(' '));                                                          // 76
  }                                                                                                     // 77
});                                                                                                     // 78
                                                                                                        // 79
var ClassHandler = BaseClassHandler.extend({                                                            // 80
  // @param rawValue {String}                                                                           // 81
  getCurrentValue: function (element) {                                                                 // 82
    return element.className;                                                                           // 83
  },                                                                                                    // 84
  setValue: function (element, className) {                                                             // 85
    element.className = className;                                                                      // 86
  }                                                                                                     // 87
});                                                                                                     // 88
                                                                                                        // 89
var SVGClassHandler = BaseClassHandler.extend({                                                         // 90
  getCurrentValue: function (element) {                                                                 // 91
    return element.className.baseVal;                                                                   // 92
  },                                                                                                    // 93
  setValue: function (element, className) {                                                             // 94
    element.setAttribute('class', className);                                                           // 95
  }                                                                                                     // 96
});                                                                                                     // 97
                                                                                                        // 98
var BooleanHandler = AttributeHandler.extend({                                                          // 99
  update: function (element, oldValue, value) {                                                         // 100
    var focused = this.focused(element);                                                                // 101
                                                                                                        // 102
    if (!focused) {                                                                                     // 103
      var name = this.name;                                                                             // 104
      if (value == null) {                                                                              // 105
        if (oldValue != null)                                                                           // 106
          element[name] = false;                                                                        // 107
      } else {                                                                                          // 108
        element[name] = true;                                                                           // 109
      }                                                                                                 // 110
    }                                                                                                   // 111
  },                                                                                                    // 112
  // is the element part of a control which is focused?                                                 // 113
  focused: function (element) {                                                                         // 114
    if (element.tagName === 'INPUT') {                                                                  // 115
      return element === document.activeElement;                                                        // 116
                                                                                                        // 117
    } else if (element.tagName === 'OPTION') {                                                          // 118
      // find the containing SELECT element, on which focus                                             // 119
      // is actually set                                                                                // 120
      var selectEl = element;                                                                           // 121
      while (selectEl && selectEl.tagName !== 'SELECT')                                                 // 122
        selectEl = selectEl.parentNode;                                                                 // 123
                                                                                                        // 124
      if (selectEl)                                                                                     // 125
        return selectEl === document.activeElement;                                                     // 126
      else                                                                                              // 127
        return false;                                                                                   // 128
    } else {                                                                                            // 129
      throw new Error("Expected INPUT or OPTION element");                                              // 130
    }                                                                                                   // 131
  }                                                                                                     // 132
});                                                                                                     // 133
                                                                                                        // 134
var ValueHandler = AttributeHandler.extend({                                                            // 135
  update: function (element, oldValue, value) {                                                         // 136
    var focused = (element === document.activeElement);                                                 // 137
                                                                                                        // 138
    if (!focused)                                                                                       // 139
      element.value = value;                                                                            // 140
  }                                                                                                     // 141
});                                                                                                     // 142
                                                                                                        // 143
// attributes of the type 'xlink:something' should be set using                                         // 144
// the correct namespace in order to work                                                               // 145
var XlinkHandler = AttributeHandler.extend({                                                            // 146
  update: function(element, oldValue, value) {                                                          // 147
    var NS = 'http://www.w3.org/1999/xlink';                                                            // 148
    if (value === null) {                                                                               // 149
      if (oldValue !== null)                                                                            // 150
        element.removeAttributeNS(NS, this.name);                                                       // 151
    } else {                                                                                            // 152
      element.setAttributeNS(NS, this.name, this.value);                                                // 153
    }                                                                                                   // 154
  }                                                                                                     // 155
});                                                                                                     // 156
                                                                                                        // 157
// cross-browser version of `instanceof SVGElement`                                                     // 158
var isSVGElement = function (elem) {                                                                    // 159
  return 'ownerSVGElement' in elem;                                                                     // 160
};                                                                                                      // 161
                                                                                                        // 162
var isUrlAttribute = function (tagName, attrName) {                                                     // 163
  // Compiled from http://www.w3.org/TR/REC-html40/index/attributes.html                                // 164
  // and                                                                                                // 165
  // http://www.w3.org/html/wg/drafts/html/master/index.html#attributes-1                               // 166
  var urlAttrs = {                                                                                      // 167
    FORM: ['action'],                                                                                   // 168
    BODY: ['background'],                                                                               // 169
    BLOCKQUOTE: ['cite'],                                                                               // 170
    Q: ['cite'],                                                                                        // 171
    DEL: ['cite'],                                                                                      // 172
    INS: ['cite'],                                                                                      // 173
    OBJECT: ['classid', 'codebase', 'data', 'usemap'],                                                  // 174
    APPLET: ['codebase'],                                                                               // 175
    A: ['href'],                                                                                        // 176
    AREA: ['href'],                                                                                     // 177
    LINK: ['href'],                                                                                     // 178
    BASE: ['href'],                                                                                     // 179
    IMG: ['longdesc', 'src', 'usemap'],                                                                 // 180
    FRAME: ['longdesc', 'src'],                                                                         // 181
    IFRAME: ['longdesc', 'src'],                                                                        // 182
    HEAD: ['profile'],                                                                                  // 183
    SCRIPT: ['src'],                                                                                    // 184
    INPUT: ['src', 'usemap', 'formaction'],                                                             // 185
    BUTTON: ['formaction'],                                                                             // 186
    BASE: ['href'],                                                                                     // 187
    MENUITEM: ['icon'],                                                                                 // 188
    HTML: ['manifest'],                                                                                 // 189
    VIDEO: ['poster']                                                                                   // 190
  };                                                                                                    // 191
                                                                                                        // 192
  if (attrName === 'itemid') {                                                                          // 193
    return true;                                                                                        // 194
  }                                                                                                     // 195
                                                                                                        // 196
  var urlAttrNames = urlAttrs[tagName] || [];                                                           // 197
  return _.contains(urlAttrNames, attrName);                                                            // 198
};                                                                                                      // 199
                                                                                                        // 200
// To get the protocol for a URL, we let the browser normalize it for                                   // 201
// us, by setting it as the href for an anchor tag and then reading out                                 // 202
// the 'protocol' property.                                                                             // 203
if (Meteor.isClient) {                                                                                  // 204
  var anchorForNormalization = document.createElement('A');                                             // 205
}                                                                                                       // 206
                                                                                                        // 207
var normalizeUrl = function (url) {                                                                     // 208
  if (Meteor.isClient) {                                                                                // 209
    anchorForNormalization.href = url;                                                                  // 210
    return anchorForNormalization.href;                                                                 // 211
  } else {                                                                                              // 212
    throw new Error('normalizeUrl not implemented on the server');                                      // 213
  }                                                                                                     // 214
};                                                                                                      // 215
                                                                                                        // 216
// UrlHandler is an attribute handler for all HTML attributes that take                                 // 217
// URL values. It disallows javascript: URLs, unless                                                    // 218
// UI._allowJavascriptUrls() has been called. To detect javascript:                                     // 219
// urls, we set the attribute and then reads the attribute out of the                                   // 220
// DOM, in order to avoid writing our own URL normalization code. (We                                   // 221
// don't want to be fooled by ' javascript:alert(1)' or                                                 // 222
// 'jAvAsCrIpT:alert(1)'.) In future, when the URL interface is more                                    // 223
// widely supported, we can use that, which will be                                                     // 224
// cleaner.  https://developer.mozilla.org/en-US/docs/Web/API/URL                                       // 225
var origUpdate = AttributeHandler.prototype.update;                                                     // 226
var UrlHandler = AttributeHandler.extend({                                                              // 227
  update: function (element, oldValue, value) {                                                         // 228
    var self = this;                                                                                    // 229
    var args = arguments;                                                                               // 230
                                                                                                        // 231
    if (UI._javascriptUrlsAllowed()) {                                                                  // 232
      origUpdate.apply(self, args);                                                                     // 233
    } else {                                                                                            // 234
      var isJavascriptProtocol =                                                                        // 235
            (normalizeUrl(value).indexOf('javascript:') === 0);                                         // 236
      if (isJavascriptProtocol) {                                                                       // 237
        Meteor._debug("URLs that use the 'javascript:' protocol are not " +                             // 238
                      "allowed in URL attribute values. " +                                             // 239
                      "Call UI._allowJavascriptUrls() " +                                               // 240
                      "to enable them.");                                                               // 241
        origUpdate.apply(self, [element, oldValue, null]);                                              // 242
      } else {                                                                                          // 243
        origUpdate.apply(self, args);                                                                   // 244
      }                                                                                                 // 245
    }                                                                                                   // 246
  }                                                                                                     // 247
});                                                                                                     // 248
                                                                                                        // 249
// XXX make it possible for users to register attribute handlers!                                       // 250
makeAttributeHandler = function (elem, name, value) {                                                   // 251
  // generally, use setAttribute but certain attributes need to be set                                  // 252
  // by directly setting a JavaScript property on the DOM element.                                      // 253
  if (name === 'class') {                                                                               // 254
    if (isSVGElement(elem)) {                                                                           // 255
      return new SVGClassHandler(name, value);                                                          // 256
    } else {                                                                                            // 257
      return new ClassHandler(name, value);                                                             // 258
    }                                                                                                   // 259
  } else if ((elem.tagName === 'OPTION' && name === 'selected') ||                                      // 260
             (elem.tagName === 'INPUT' && name === 'checked')) {                                        // 261
    return new BooleanHandler(name, value);                                                             // 262
  } else if ((elem.tagName === 'TEXTAREA' || elem.tagName === 'INPUT')                                  // 263
             && name === 'value') {                                                                     // 264
    // internally, TEXTAREAs tracks their value in the 'value'                                          // 265
    // attribute just like INPUTs.                                                                      // 266
    return new ValueHandler(name, value);                                                               // 267
  } else if (name.substring(0,6) === 'xlink:') {                                                        // 268
    return new XlinkHandler(name.substring(6), value);                                                  // 269
  } else if (isUrlAttribute(elem.tagName, name)) {                                                      // 270
    return new UrlHandler(name, value);                                                                 // 271
  } else {                                                                                              // 272
    return new AttributeHandler(name, value);                                                           // 273
  }                                                                                                     // 274
                                                                                                        // 275
  // XXX will need one for 'style' on IE, though modern browsers                                        // 276
  // seem to handle setAttribute ok.                                                                    // 277
};                                                                                                      // 278
                                                                                                        // 279
                                                                                                        // 280
ElementAttributesUpdater = function (elem) {                                                            // 281
  this.elem = elem;                                                                                     // 282
  this.handlers = {};                                                                                   // 283
};                                                                                                      // 284
                                                                                                        // 285
// Update attributes on `elem` to the dictionary `attrs`, whose                                         // 286
// values are strings.                                                                                  // 287
ElementAttributesUpdater.prototype.update = function(newAttrs) {                                        // 288
  var elem = this.elem;                                                                                 // 289
  var handlers = this.handlers;                                                                         // 290
                                                                                                        // 291
  for (var k in handlers) {                                                                             // 292
    if (! newAttrs.hasOwnProperty(k)) {                                                                 // 293
      // remove attributes (and handlers) for attribute names                                           // 294
      // that don't exist as keys of `newAttrs` and so won't                                            // 295
      // be visited when traversing it.  (Attributes that                                               // 296
      // exist in the `newAttrs` object but are `null`                                                  // 297
      // are handled later.)                                                                            // 298
      var handler = handlers[k];                                                                        // 299
      var oldValue = handler.value;                                                                     // 300
      handler.value = null;                                                                             // 301
      handler.update(elem, oldValue, null);                                                             // 302
      delete handlers[k];                                                                               // 303
    }                                                                                                   // 304
  }                                                                                                     // 305
                                                                                                        // 306
  for (var k in newAttrs) {                                                                             // 307
    var handler = null;                                                                                 // 308
    var oldValue;                                                                                       // 309
    var value = newAttrs[k];                                                                            // 310
    if (! handlers.hasOwnProperty(k)) {                                                                 // 311
      if (value !== null) {                                                                             // 312
        // make new handler                                                                             // 313
        handler = makeAttributeHandler(elem, k, value);                                                 // 314
        handlers[k] = handler;                                                                          // 315
        oldValue = null;                                                                                // 316
      }                                                                                                 // 317
    } else {                                                                                            // 318
      handler = handlers[k];                                                                            // 319
      oldValue = handler.value;                                                                         // 320
    }                                                                                                   // 321
    if (oldValue !== value) {                                                                           // 322
      handler.value = value;                                                                            // 323
      handler.update(elem, oldValue, value);                                                            // 324
      if (value === null)                                                                               // 325
        delete handlers[k];                                                                             // 326
    }                                                                                                   // 327
  }                                                                                                     // 328
};                                                                                                      // 329
                                                                                                        // 330
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/render.js                                                                                //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
UI.Component.instantiate = function (parent) {                                                          // 2
  var kind = this;                                                                                      // 3
                                                                                                        // 4
  // check arguments                                                                                    // 5
  if (UI.isComponent(kind)) {                                                                           // 6
    if (kind.isInited)                                                                                  // 7
      throw new Error("A component kind is required, not an instance");                                 // 8
  } else {                                                                                              // 9
    throw new Error("Expected Component kind");                                                         // 10
  }                                                                                                     // 11
                                                                                                        // 12
  var inst = kind.extend(); // XXX args go here                                                         // 13
  inst.isInited = true;                                                                                 // 14
                                                                                                        // 15
  // XXX messy to define this here                                                                      // 16
  inst.templateInstance = {                                                                             // 17
    findAll: function (selector) {                                                                      // 18
      // XXX check that `.dom` exists here?                                                             // 19
      return inst.dom.$(selector);                                                                      // 20
    },                                                                                                  // 21
    find: function (selector) {                                                                         // 22
      var result = this.findAll(selector);                                                              // 23
      return result[0] || null;                                                                         // 24
    },                                                                                                  // 25
    firstNode: null,                                                                                    // 26
    lastNode: null,                                                                                     // 27
    data: null,                                                                                         // 28
    __component__: inst                                                                                 // 29
  };                                                                                                    // 30
  inst.templateInstance.$ = inst.templateInstance.findAll;                                              // 31
                                                                                                        // 32
  inst.parent = (parent || null);                                                                       // 33
                                                                                                        // 34
  if (inst.init)                                                                                        // 35
    inst.init();                                                                                        // 36
                                                                                                        // 37
  if (inst.created) {                                                                                   // 38
    updateTemplateInstance(inst);                                                                       // 39
    inst.created.call(inst.templateInstance);                                                           // 40
  }                                                                                                     // 41
                                                                                                        // 42
  return inst;                                                                                          // 43
};                                                                                                      // 44
                                                                                                        // 45
UI.Component.render = function () {                                                                     // 46
  return null;                                                                                          // 47
};                                                                                                      // 48
                                                                                                        // 49
var Box = function (func, equals) {                                                                     // 50
  var self = this;                                                                                      // 51
                                                                                                        // 52
  self.func = func;                                                                                     // 53
  self.equals = equals;                                                                                 // 54
                                                                                                        // 55
  self.curResult = null;                                                                                // 56
                                                                                                        // 57
  self.dep = new Deps.Dependency;                                                                       // 58
                                                                                                        // 59
  self.resultComputation = Deps.nonreactive(function () {                                               // 60
    return Deps.autorun(function (c) {                                                                  // 61
      var func = self.func;                                                                             // 62
                                                                                                        // 63
      var newResult = func();                                                                           // 64
                                                                                                        // 65
      if (! c.firstRun) {                                                                               // 66
        var equals = self.equals;                                                                       // 67
        var oldResult = self.curResult;                                                                 // 68
                                                                                                        // 69
        if (equals ? equals(newResult, oldResult) :                                                     // 70
            newResult === oldResult) {                                                                  // 71
          // same as last time                                                                          // 72
          return;                                                                                       // 73
        }                                                                                               // 74
      }                                                                                                 // 75
                                                                                                        // 76
      self.curResult = newResult;                                                                       // 77
      self.dep.changed();                                                                               // 78
    });                                                                                                 // 79
  });                                                                                                   // 80
};                                                                                                      // 81
                                                                                                        // 82
Box.prototype.stop = function () {                                                                      // 83
  this.resultComputation.stop();                                                                        // 84
};                                                                                                      // 85
                                                                                                        // 86
Box.prototype.get = function () {                                                                       // 87
  if (Deps.active && ! this.resultComputation.stopped)                                                  // 88
    this.dep.depend();                                                                                  // 89
                                                                                                        // 90
  return this.curResult;                                                                                // 91
};                                                                                                      // 92
                                                                                                        // 93
// Takes a reactive function (call it `inner`) and returns a reactive function                          // 94
// `outer` which is equivalent except in its reactive behavior.  Specifically,                          // 95
// `outer` has the following two special properties:                                                    // 96
//                                                                                                      // 97
// 1. Isolation:  An invocation of `outer()` only invalidates its context                               // 98
//    when the value of `inner()` changes.  For example, `inner` may be a                               // 99
//    function that gets one or more Session variables and calculates a                                 // 100
//    true/false value.  `outer` blocks invalidation signals caused by the                              // 101
//    Session variables changing and sends a signal out only when the value                             // 102
//    changes between true and false (in this example).  The value can be                               // 103
//    of any type, and it is compared with `===` unless an `equals` function                            // 104
//    is provided.                                                                                      // 105
//                                                                                                      // 106
// 2. Value Sharing:  The `outer` function returned by `emboxValue` can be                              // 107
//    shared between different contexts, for example by assigning it to an                              // 108
//    object as a method that can be accessed at any time, such as by                                   // 109
//    different templates or different parts of a template.  No matter                                  // 110
//    how many times `outer` is called, `inner` is only called once until                               // 111
//    it changes.  The most recent value is stored internally.                                          // 112
//                                                                                                      // 113
// Conceptually, an emboxed value is much like a Session variable which is                              // 114
// kept up to date by an autorun.  Session variables provide storage                                    // 115
// (value sharing) and they don't notify their listeners unless a value                                 // 116
// actually changes (isolation).  The biggest difference is that such an                                // 117
// autorun would never be stopped, and the Session variable would never be                              // 118
// deleted even if it wasn't used any more.  An emboxed value, on the other                             // 119
// hand, automatically stops computing when it's not being used, and starts                             // 120
// again when called from a reactive context.  This means that when it stops                            // 121
// being used, it can be completely garbage-collected.                                                  // 122
//                                                                                                      // 123
// If a non-function value is supplied to `emboxValue` instead of a reactive                            // 124
// function, then `outer` is still a function but it simply returns the value.                          // 125
//                                                                                                      // 126
UI.emboxValue = function (funcOrValue, equals) {                                                        // 127
  if (typeof funcOrValue === 'function') {                                                              // 128
                                                                                                        // 129
    var func = funcOrValue;                                                                             // 130
    var box = new Box(func, equals);                                                                    // 131
                                                                                                        // 132
    var f = function () {                                                                               // 133
      return box.get();                                                                                 // 134
    };                                                                                                  // 135
                                                                                                        // 136
    f.stop = function () {                                                                              // 137
      box.stop();                                                                                       // 138
    };                                                                                                  // 139
                                                                                                        // 140
    return f;                                                                                           // 141
                                                                                                        // 142
  } else {                                                                                              // 143
    var value = funcOrValue;                                                                            // 144
    var result = function () {                                                                          // 145
      return value;                                                                                     // 146
    };                                                                                                  // 147
    result._isEmboxedConstant = true;                                                                   // 148
    return result;                                                                                      // 149
  }                                                                                                     // 150
};                                                                                                      // 151
                                                                                                        // 152
                                                                                                        // 153
UI.namedEmboxValue = function (name, funcOrValue, equals) {                                             // 154
  if (! Deps.active) {                                                                                  // 155
    var f = UI.emboxValue(funcOrValue, equals);                                                         // 156
    f.stop();                                                                                           // 157
    return f;                                                                                           // 158
  }                                                                                                     // 159
                                                                                                        // 160
  var c = Deps.currentComputation;                                                                      // 161
  if (! c[name])                                                                                        // 162
    c[name] = UI.emboxValue(funcOrValue, equals);                                                       // 163
                                                                                                        // 164
  return c[name];                                                                                       // 165
};                                                                                                      // 166
                                                                                                        // 167
////////////////////////////////////////                                                                // 168
                                                                                                        // 169
UI.insert = function (renderedTemplate, parentElement, nextNode) {                                      // 170
  if (! renderedTemplate.dom)                                                                           // 171
    throw new Error("Expected template rendered with UI.render");                                       // 172
                                                                                                        // 173
  UI.DomRange.insert(renderedTemplate.dom, parentElement, nextNode);                                    // 174
};                                                                                                      // 175
                                                                                                        // 176
// Insert a DOM node or DomRange into a DOM element or DomRange.                                        // 177
//                                                                                                      // 178
// One of three things happens depending on what needs to be inserted into what:                        // 179
// - `range.add` (anything into DomRange)                                                               // 180
// - `UI.DomRange.insert` (DomRange into element)                                                       // 181
// - `elem.insertBefore` (node into element)                                                            // 182
//                                                                                                      // 183
// The optional `before` argument is an existing node or id to insert before in                         // 184
// the parent element or DomRange.                                                                      // 185
var insert = function (nodeOrRange, parent, before) {                                                   // 186
  if (! parent)                                                                                         // 187
    throw new Error("Materialization parent required");                                                 // 188
                                                                                                        // 189
  if (parent instanceof UI.DomRange) {                                                                  // 190
    parent.add(nodeOrRange, before);                                                                    // 191
  } else if (nodeOrRange instanceof UI.DomRange) {                                                      // 192
    // parent is an element; inserting a range                                                          // 193
    UI.DomRange.insert(nodeOrRange, parent, before);                                                    // 194
  } else {                                                                                              // 195
    // parent is an element; inserting an element                                                       // 196
    parent.insertBefore(nodeOrRange, before || null); // `null` for IE                                  // 197
  }                                                                                                     // 198
};                                                                                                      // 199
                                                                                                        // 200
UI.render = function (kind, parentComponent) {                                                          // 201
  if (kind.isInited)                                                                                    // 202
    throw new Error("Can't render component instance, only component kind");                            // 203
                                                                                                        // 204
  var inst, content, range;                                                                             // 205
                                                                                                        // 206
  Deps.nonreactive(function () {                                                                        // 207
                                                                                                        // 208
    inst = kind.instantiate(parentComponent);                                                           // 209
                                                                                                        // 210
    content = (inst.render && inst.render());                                                           // 211
                                                                                                        // 212
    range = new UI.DomRange;                                                                            // 213
    inst.dom = range;                                                                                   // 214
    range.component = inst;                                                                             // 215
                                                                                                        // 216
  });                                                                                                   // 217
                                                                                                        // 218
  materialize(content, range, null, inst);                                                              // 219
                                                                                                        // 220
  range.removed = function () {                                                                         // 221
    inst.isDestroyed = true;                                                                            // 222
    if (inst.destroyed) {                                                                               // 223
      Deps.nonreactive(function () {                                                                    // 224
        updateTemplateInstance(inst);                                                                   // 225
        inst.destroyed.call(inst.templateInstance);                                                     // 226
      });                                                                                               // 227
    }                                                                                                   // 228
  };                                                                                                    // 229
                                                                                                        // 230
  return inst;                                                                                          // 231
};                                                                                                      // 232
                                                                                                        // 233
UI.renderWithData = function (kind, data, parentComponent) {                                            // 234
  if (! UI.isComponent(kind))                                                                           // 235
    throw new Error("Component required here");                                                         // 236
  if (kind.isInited)                                                                                    // 237
    throw new Error("Can't render component instance, only component kind");                            // 238
  if (typeof data === 'function')                                                                       // 239
    throw new Error("Data argument can't be a function");                                               // 240
                                                                                                        // 241
  return UI.render(kind.extend({data: function () { return data; }}),                                   // 242
                   parentComponent);                                                                    // 243
};                                                                                                      // 244
                                                                                                        // 245
var contentEquals = function (a, b) {                                                                   // 246
  if (a instanceof HTML.Raw) {                                                                          // 247
    return (b instanceof HTML.Raw) && (a.value === b.value);                                            // 248
  } else if (a == null) {                                                                               // 249
    return (b == null);                                                                                 // 250
  } else {                                                                                              // 251
    return (a === b) &&                                                                                 // 252
      ((typeof a === 'number') || (typeof a === 'boolean') ||                                           // 253
       (typeof a === 'string'));                                                                        // 254
  }                                                                                                     // 255
};                                                                                                      // 256
                                                                                                        // 257
UI.InTemplateScope = function (tmplInstance, content) {                                                 // 258
  if (! (this instanceof UI.InTemplateScope))                                                           // 259
    // called without `new`                                                                             // 260
    return new UI.InTemplateScope(tmplInstance, content);                                               // 261
                                                                                                        // 262
  var parentPtr = tmplInstance.parent;                                                                  // 263
  if (parentPtr.__isTemplateWith)                                                                       // 264
    parentPtr = parentPtr.parent;                                                                       // 265
                                                                                                        // 266
  this.parentPtr = parentPtr;                                                                           // 267
  this.content = content;                                                                               // 268
};                                                                                                      // 269
                                                                                                        // 270
UI.InTemplateScope.prototype.toHTML = function (parentComponent) {                                      // 271
  return HTML.toHTML(this.content, this.parentPtr);                                                     // 272
};                                                                                                      // 273
                                                                                                        // 274
UI.InTemplateScope.prototype.toText = function (textMode, parentComponent) {                            // 275
  return HTML.toText(this.content, textMode, this.parentPtr);                                           // 276
};                                                                                                      // 277
                                                                                                        // 278
// Convert the pseudoDOM `node` into reactive DOM nodes and insert them                                 // 279
// into the element or DomRange `parent`, before the node or id `before`.                               // 280
var materialize = function (node, parent, before, parentComponent) {                                    // 281
  // XXX should do more error-checking for the case where user is supplying the tags.                   // 282
  // For example, check that CharRef has `html` and `str` properties and no content.                    // 283
  // Check that Comment has a single string child and no attributes.  Etc.                              // 284
                                                                                                        // 285
  if (node == null) {                                                                                   // 286
    // null or undefined.                                                                               // 287
    // do nothinge.                                                                                     // 288
  } else if ((typeof node === 'string') || (typeof node === 'boolean') || (typeof node === 'number')) { // 289
    node = String(node);                                                                                // 290
    insert(document.createTextNode(node), parent, before);                                              // 291
  } else if (node instanceof Array) {                                                                   // 292
    for (var i = 0; i < node.length; i++)                                                               // 293
      materialize(node[i], parent, before, parentComponent);                                            // 294
  } else if (typeof node === 'function') {                                                              // 295
                                                                                                        // 296
    var range = new UI.DomRange;                                                                        // 297
    var lastContent = null;                                                                             // 298
    var rangeUpdater = Deps.autorun(function (c) {                                                      // 299
      var content = node();                                                                             // 300
      // normalize content a little, for easier comparison                                              // 301
      if (HTML.isNully(content))                                                                        // 302
        content = null;                                                                                 // 303
      else if ((content instanceof Array) && content.length === 1)                                      // 304
        content = content[0];                                                                           // 305
                                                                                                        // 306
      // update if content is different from last time                                                  // 307
      if (! contentEquals(content, lastContent)) {                                                      // 308
        lastContent = content;                                                                          // 309
                                                                                                        // 310
        if (! c.firstRun)                                                                               // 311
          range.removeAll();                                                                            // 312
                                                                                                        // 313
        materialize(content, range, null, parentComponent);                                             // 314
      }                                                                                                 // 315
    });                                                                                                 // 316
    range.removed = function () {                                                                       // 317
      rangeUpdater.stop();                                                                              // 318
      if (node.stop)                                                                                    // 319
        node.stop();                                                                                    // 320
    };                                                                                                  // 321
    // XXXX HACK                                                                                        // 322
    if (Deps.active && node.stop) {                                                                     // 323
      Deps.onInvalidate(function () {                                                                   // 324
        node.stop();                                                                                    // 325
      });                                                                                               // 326
    }                                                                                                   // 327
    insert(range, parent, before);                                                                      // 328
  } else if (node instanceof HTML.Tag) {                                                                // 329
    var tagName = node.tagName;                                                                         // 330
    var elem;                                                                                           // 331
    if (HTML.isKnownSVGElement(tagName) && document.createElementNS) {                                  // 332
      elem = document.createElementNS('http://www.w3.org/2000/svg', tagName);                           // 333
    } else {                                                                                            // 334
      elem = document.createElement(node.tagName);                                                      // 335
    }                                                                                                   // 336
                                                                                                        // 337
    var rawAttrs = node.attrs;                                                                          // 338
    var children = node.children;                                                                       // 339
    if (node.tagName === 'textarea') {                                                                  // 340
      rawAttrs = (rawAttrs || {});                                                                      // 341
      rawAttrs.value = children;                                                                        // 342
      children = [];                                                                                    // 343
    };                                                                                                  // 344
                                                                                                        // 345
    if (rawAttrs) {                                                                                     // 346
      var attrComp = Deps.autorun(function (c) {                                                        // 347
        var attrUpdater = c.updater;                                                                    // 348
        if (! attrUpdater) {                                                                            // 349
          attrUpdater = c.updater = new ElementAttributesUpdater(elem);                                 // 350
        }                                                                                               // 351
                                                                                                        // 352
        try {                                                                                           // 353
          var attrs = HTML.evaluateAttributes(rawAttrs, parentComponent);                               // 354
          var stringAttrs = {};                                                                         // 355
          if (attrs) {                                                                                  // 356
            for (var k in attrs) {                                                                      // 357
              stringAttrs[k] = HTML.toText(attrs[k], HTML.TEXTMODE.STRING,                              // 358
                                           parentComponent);                                            // 359
            }                                                                                           // 360
            attrUpdater.update(stringAttrs);                                                            // 361
          }                                                                                             // 362
        } catch (e) {                                                                                   // 363
          reportUIException(e);                                                                         // 364
        }                                                                                               // 365
      });                                                                                               // 366
      UI.DomBackend.onRemoveElement(elem, function () {                                                 // 367
        attrComp.stop();                                                                                // 368
      });                                                                                               // 369
    }                                                                                                   // 370
    materialize(children, elem, null, parentComponent);                                                 // 371
                                                                                                        // 372
    insert(elem, parent, before);                                                                       // 373
  } else if (typeof node.instantiate === 'function') {                                                  // 374
    // component                                                                                        // 375
    var instance = UI.render(node, parentComponent);                                                    // 376
                                                                                                        // 377
    // Call internal callback, which may take advantage of the current                                  // 378
    // Deps computation.                                                                                // 379
    if (instance.materialized)                                                                          // 380
      instance.materialized();                                                                          // 381
                                                                                                        // 382
    insert(instance.dom, parent, before);                                                               // 383
  } else if (node instanceof HTML.CharRef) {                                                            // 384
    insert(document.createTextNode(node.str), parent, before);                                          // 385
  } else if (node instanceof HTML.Comment) {                                                            // 386
    insert(document.createComment(node.sanitizedValue), parent, before);                                // 387
  } else if (node instanceof HTML.Raw) {                                                                // 388
    // Get an array of DOM nodes by using the browser's HTML parser                                     // 389
    // (like innerHTML).                                                                                // 390
    var htmlNodes = UI.DomBackend.parseHTML(node.value);                                                // 391
    for (var i = 0; i < htmlNodes.length; i++)                                                          // 392
      insert(htmlNodes[i], parent, before);                                                             // 393
  } else if (Package['html-tools'] && (node instanceof Package['html-tools'].HTMLTools.Special)) {      // 394
    throw new Error("Can't materialize Special tag, it's just an intermediate rep");                    // 395
  } else if (node instanceof UI.InTemplateScope) {                                                      // 396
    materialize(node.content, parent, before, node.parentPtr);                                          // 397
  } else {                                                                                              // 398
    // can't get here                                                                                   // 399
    throw new Error("Unexpected node in htmljs: " + node);                                              // 400
  }                                                                                                     // 401
};                                                                                                      // 402
                                                                                                        // 403
                                                                                                        // 404
                                                                                                        // 405
// XXX figure out the right names, and namespace, for these.                                            // 406
// for example, maybe some of them go in the HTML package.                                              // 407
UI.materialize = materialize;                                                                           // 408
                                                                                                        // 409
UI.body = UI.Component.extend({                                                                         // 410
  kind: 'body',                                                                                         // 411
  contentParts: [],                                                                                     // 412
  render: function () {                                                                                 // 413
    return this.contentParts;                                                                           // 414
  },                                                                                                    // 415
  // XXX revisit how body works.                                                                        // 416
  INSTANTIATED: false,                                                                                  // 417
  __helperHost: true                                                                                    // 418
});                                                                                                     // 419
                                                                                                        // 420
UI.block = function (renderFunc) {                                                                      // 421
  return UI.Component.extend({ render: renderFunc });                                                   // 422
};                                                                                                      // 423
                                                                                                        // 424
UI.toHTML = function (content, parentComponent) {                                                       // 425
  return HTML.toHTML(content, parentComponent);                                                         // 426
};                                                                                                      // 427
                                                                                                        // 428
UI.toRawText = function (content, parentComponent) {                                                    // 429
  return HTML.toText(content, HTML.TEXTMODE.STRING, parentComponent);                                   // 430
};                                                                                                      // 431
                                                                                                        // 432
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/builtins.js                                                                              //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
UI.If = function (argFunc, contentBlock, elseContentBlock) {                                            // 2
  checkBlockHelperArguments('If', argFunc, contentBlock, elseContentBlock);                             // 3
                                                                                                        // 4
  var f = function () {                                                                                 // 5
    var emboxedCondition = emboxCondition(argFunc);                                                     // 6
    f.stop = function () {                                                                              // 7
      emboxedCondition.stop();                                                                          // 8
    };                                                                                                  // 9
    if (emboxedCondition())                                                                             // 10
      return contentBlock;                                                                              // 11
    else                                                                                                // 12
      return elseContentBlock || null;                                                                  // 13
  };                                                                                                    // 14
                                                                                                        // 15
  return f;                                                                                             // 16
};                                                                                                      // 17
                                                                                                        // 18
                                                                                                        // 19
UI.Unless = function (argFunc, contentBlock, elseContentBlock) {                                        // 20
  checkBlockHelperArguments('Unless', argFunc, contentBlock, elseContentBlock);                         // 21
                                                                                                        // 22
  var f = function () {                                                                                 // 23
    var emboxedCondition = emboxCondition(argFunc);                                                     // 24
    f.stop = function () {                                                                              // 25
      emboxedCondition.stop();                                                                          // 26
    };                                                                                                  // 27
    if (! emboxedCondition())                                                                           // 28
      return contentBlock;                                                                              // 29
    else                                                                                                // 30
      return elseContentBlock || null;                                                                  // 31
  };                                                                                                    // 32
                                                                                                        // 33
  return f;                                                                                             // 34
};                                                                                                      // 35
                                                                                                        // 36
// Returns true if `a` and `b` are `===`, unless they are of a mutable type.                            // 37
// (Because then, they may be equal references to an object that was mutated,                           // 38
// and we'll never know.  We save only a reference to the old object; we don't                          // 39
// do any deep-copying or diffing.)                                                                     // 40
UI.safeEquals = function (a, b) {                                                                       // 41
  if (a !== b)                                                                                          // 42
    return false;                                                                                       // 43
  else                                                                                                  // 44
    return ((!a) || (typeof a === 'number') || (typeof a === 'boolean') ||                              // 45
            (typeof a === 'string'));                                                                   // 46
};                                                                                                      // 47
                                                                                                        // 48
// Unlike Spacebars.With, there's no else case and no conditional logic.                                // 49
//                                                                                                      // 50
// We don't do any reactive emboxing of `argFunc` here; it should be done                               // 51
// by the caller if efficiency and/or number of calls to the data source                                // 52
// is important.                                                                                        // 53
UI.With = function (argFunc, contentBlock) {                                                            // 54
  checkBlockHelperArguments('With', argFunc, contentBlock);                                             // 55
                                                                                                        // 56
  var block = contentBlock;                                                                             // 57
  if ('data' in block) {                                                                                // 58
    // XXX TODO: get religion about where `data` property goes                                          // 59
    block = UI.block(function () {                                                                      // 60
      return contentBlock;                                                                              // 61
    });                                                                                                 // 62
  }                                                                                                     // 63
                                                                                                        // 64
  block.data = function () {                                                                            // 65
    throw new Error("Can't get data for component kind");                                               // 66
  };                                                                                                    // 67
                                                                                                        // 68
  block.init = function () {                                                                            // 69
    this.data = UI.emboxValue(argFunc, UI.safeEquals);                                                  // 70
  };                                                                                                    // 71
                                                                                                        // 72
  block.materialized = function () {                                                                    // 73
    var self = this;                                                                                    // 74
    if (Deps.active) {                                                                                  // 75
      Deps.onInvalidate(function () {                                                                   // 76
        self.data.stop();                                                                               // 77
      });                                                                                               // 78
    }                                                                                                   // 79
  };                                                                                                    // 80
  block.materialized.isWith = true;                                                                     // 81
                                                                                                        // 82
  return block;                                                                                         // 83
};                                                                                                      // 84
                                                                                                        // 85
UI.Each = function (argFunc, contentBlock, elseContentBlock) {                                          // 86
  checkBlockHelperArguments('Each', argFunc, contentBlock, elseContentBlock);                           // 87
                                                                                                        // 88
  return UI.EachImpl.extend({                                                                           // 89
    __sequence: argFunc,                                                                                // 90
    __content: contentBlock,                                                                            // 91
    __elseContent: elseContentBlock                                                                     // 92
  });                                                                                                   // 93
};                                                                                                      // 94
                                                                                                        // 95
var checkBlockHelperArguments = function (which, argFunc, contentBlock, elseContentBlock) {             // 96
  if (typeof argFunc !== 'function')                                                                    // 97
    throw new Error('First argument to ' + which + ' must be a function');                              // 98
  if (! UI.isComponent(contentBlock))                                                                   // 99
    throw new Error('Second argument to ' + which + ' must be a template or UI.block');                 // 100
  if (elseContentBlock && ! UI.isComponent(elseContentBlock))                                           // 101
    throw new Error('Third argument to ' + which + ' must be a template or UI.block if present');       // 102
};                                                                                                      // 103
                                                                                                        // 104
// Returns a function that computes `!! conditionFunc()` except:                                        // 105
//                                                                                                      // 106
// - Empty array is considered falsy                                                                    // 107
// - The result is UI.emboxValue'd (doesn't trigger invalidation                                        // 108
//   as long as the condition stays truthy or stays falsy)                                              // 109
var emboxCondition = function (conditionFunc) {                                                         // 110
  return UI.namedEmboxValue('if/unless', function () {                                                  // 111
    // `condition` is emboxed; it is always a function,                                                 // 112
    // and it only triggers invalidation if its return                                                  // 113
    // value actually changes.  We still need to isolate                                                // 114
    // the calculation of whether it is truthy or falsy                                                 // 115
    // in order to not re-render if it changes from one                                                 // 116
    // truthy or falsy value to another.                                                                // 117
    var cond = conditionFunc();                                                                         // 118
                                                                                                        // 119
    // empty arrays are treated as falsey values                                                        // 120
    if (cond instanceof Array && cond.length === 0)                                                     // 121
      return false;                                                                                     // 122
    else                                                                                                // 123
      return !! cond;                                                                                   // 124
  });                                                                                                   // 125
};                                                                                                      // 126
                                                                                                        // 127
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/each.js                                                                                  //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
UI.EachImpl = Component.extend({                                                                        // 1
  typeName: 'Each',                                                                                     // 2
  render: function (modeHint) {                                                                         // 3
    var self = this;                                                                                    // 4
    var content = self.__content;                                                                       // 5
    var elseContent = self.__elseContent;                                                               // 6
                                                                                                        // 7
    if (modeHint === 'STATIC') {                                                                        // 8
      // This is a hack.  The caller gives us a hint if the                                             // 9
      // value we return will be static (in HTML or text)                                               // 10
      // or dynamic (materialized DOM).  The dynamic path                                               // 11
      // returns `null` and then we populate the DOM from                                               // 12
      // the `materialized` callback.                                                                   // 13
      //                                                                                                // 14
      // It would be much cleaner to always return the same                                             // 15
      // value here, and to have that value be some special                                             // 16
      // object that encapsulates the logic for populating                                              // 17
      // the #each using a mode-agnostic interface that                                                 // 18
      // works for HTML, text, and DOM.  Alternatively, we                                              // 19
      // could formalize the current pattern, e.g. defining                                             // 20
      // a method like component.populate(domRange) and one                                             // 21
      // like renderStatic() or even renderHTML / renderText.                                           // 22
      var parts = _.map(                                                                                // 23
        ObserveSequence.fetch(self.__sequence()),                                                       // 24
        function (item) {                                                                               // 25
          return content.extend({data: function () {                                                    // 26
            return item;                                                                                // 27
          }});                                                                                          // 28
        });                                                                                             // 29
                                                                                                        // 30
      if (parts.length) {                                                                               // 31
        return parts;                                                                                   // 32
      } else {                                                                                          // 33
        return elseContent;                                                                             // 34
      }                                                                                                 // 35
      return parts;                                                                                     // 36
    } else {                                                                                            // 37
      return null;                                                                                      // 38
    }                                                                                                   // 39
  },                                                                                                    // 40
  materialized: function () {                                                                           // 41
    var self = this;                                                                                    // 42
                                                                                                        // 43
    var range = self.dom;                                                                               // 44
                                                                                                        // 45
    var content = self.__content;                                                                       // 46
    var elseContent = self.__elseContent;                                                               // 47
                                                                                                        // 48
    // if there is an else clause, keep track of the number of                                          // 49
    // rendered items.  use this to display the else clause when count                                  // 50
    // becomes zero, and remove it when count becomes positive.                                         // 51
    var itemCount = 0;                                                                                  // 52
    var addToCount = function(delta) {                                                                  // 53
      if (!elseContent) // if no else, no need to keep track of count                                   // 54
        return;                                                                                         // 55
                                                                                                        // 56
      if (itemCount + delta < 0)                                                                        // 57
        throw new Error("count should never become negative");                                          // 58
                                                                                                        // 59
      if (itemCount === 0) {                                                                            // 60
        // remove else clause                                                                           // 61
        range.removeAll();                                                                              // 62
      }                                                                                                 // 63
      itemCount += delta;                                                                               // 64
      if (itemCount === 0) {                                                                            // 65
        UI.materialize(elseContent, range, null, self);                                                 // 66
      }                                                                                                 // 67
    };                                                                                                  // 68
                                                                                                        // 69
    this.observeHandle = ObserveSequence.observe(function () {                                          // 70
      return self.__sequence();                                                                         // 71
    }, {                                                                                                // 72
      addedAt: function (id, item, i, beforeId) {                                                       // 73
        addToCount(1);                                                                                  // 74
        id = LocalCollection._idStringify(id);                                                          // 75
                                                                                                        // 76
        var data = item;                                                                                // 77
        var dep = new Deps.Dependency;                                                                  // 78
                                                                                                        // 79
        // function to become `comp.data`                                                               // 80
        var dataFunc = function () {                                                                    // 81
          dep.depend();                                                                                 // 82
          return data;                                                                                  // 83
        };                                                                                              // 84
        // Storing `$set` on `comp.data` lets us                                                        // 85
        // access it from `changed`.                                                                    // 86
        dataFunc.$set = function (v) {                                                                  // 87
          data = v;                                                                                     // 88
          dep.changed();                                                                                // 89
        };                                                                                              // 90
                                                                                                        // 91
        if (beforeId)                                                                                   // 92
          beforeId = LocalCollection._idStringify(beforeId);                                            // 93
                                                                                                        // 94
        var renderedItem = UI.render(content.extend({data: dataFunc}), self);                           // 95
        range.add(id, renderedItem.dom, beforeId);                                                      // 96
      },                                                                                                // 97
      removedAt: function (id, item) {                                                                  // 98
        addToCount(-1);                                                                                 // 99
        range.remove(LocalCollection._idStringify(id));                                                 // 100
      },                                                                                                // 101
      movedTo: function (id, item, i, j, beforeId) {                                                    // 102
        range.moveBefore(                                                                               // 103
          LocalCollection._idStringify(id),                                                             // 104
          beforeId && LocalCollection._idStringify(beforeId));                                          // 105
      },                                                                                                // 106
      changedAt: function (id, newItem, atIndex) {                                                      // 107
        range.get(LocalCollection._idStringify(id)).component.data.$set(newItem);                       // 108
      }                                                                                                 // 109
    });                                                                                                 // 110
                                                                                                        // 111
    // on initial render, display the else clause if no items                                           // 112
    addToCount(0);                                                                                      // 113
  },                                                                                                    // 114
  destroyed: function () {                                                                              // 115
    if (this.__component__.observeHandle)                                                               // 116
      this.__component__.observeHandle.stop();                                                          // 117
  }                                                                                                     // 118
});                                                                                                     // 119
                                                                                                        // 120
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/fields.js                                                                                //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
var global = (function () { return this; })();                                                          // 2
                                                                                                        // 3
// Searches for the given property in `comp` or a parent,                                               // 4
// and returns it as is (without call it if it's a function).                                           // 5
var lookupComponentProp = function (comp, prop) {                                                       // 6
  comp = findComponentWithProp(prop, comp);                                                             // 7
  var result = (comp ? comp.data : null);                                                               // 8
  if (typeof result === 'function')                                                                     // 9
    result = _.bind(result, comp);                                                                      // 10
  return result;                                                                                        // 11
};                                                                                                      // 12
                                                                                                        // 13
// Component that's a no-op when used as a block helper like                                            // 14
// `{{#foo}}...{{/foo}}`. Prints a warning that it is deprecated.                                       // 15
var noOpComponent = function (name) {                                                                   // 16
  return Component.extend({                                                                             // 17
    kind: 'NoOp',                                                                                       // 18
    render: function () {                                                                               // 19
      Meteor._debug("{{#" + name + "}} is now unnecessary and deprecated.");                            // 20
      return this.__content;                                                                            // 21
    }                                                                                                   // 22
  });                                                                                                   // 23
};                                                                                                      // 24
                                                                                                        // 25
// This map is searched first when you do something like `{{#foo}}` in                                  // 26
// a template.                                                                                          // 27
var builtInComponents = {                                                                               // 28
  // for past compat:                                                                                   // 29
  'constant': noOpComponent("constant"),                                                                // 30
  'isolate': noOpComponent("isolate")                                                                   // 31
};                                                                                                      // 32
                                                                                                        // 33
_extend(UI.Component, {                                                                                 // 34
  // Options:                                                                                           // 35
  //                                                                                                    // 36
  // - template {Boolean} If true, look at the list of templates after                                  // 37
  //   helpers and before data context.                                                                 // 38
  lookup: function (id, opts) {                                                                         // 39
    var self = this;                                                                                    // 40
    var template = opts && opts.template;                                                               // 41
    var result;                                                                                         // 42
    var comp;                                                                                           // 43
                                                                                                        // 44
    if (!id)                                                                                            // 45
      throw new Error("must pass id to lookup");                                                        // 46
                                                                                                        // 47
    if (/^\./.test(id)) {                                                                               // 48
      // starts with a dot. must be a series of dots which maps to an                                   // 49
      // ancestor of the appropriate height.                                                            // 50
      if (!/^(\.)+$/.test(id)) {                                                                        // 51
        throw new Error("id starting with dot must be a series of dots");                               // 52
      }                                                                                                 // 53
                                                                                                        // 54
      var compWithData = findComponentWithProp('data', self);                                           // 55
      for (var i = 1; i < id.length; i++) {                                                             // 56
        compWithData = compWithData ? findComponentWithProp('data', compWithData.parent) : null;        // 57
      }                                                                                                 // 58
                                                                                                        // 59
      return (compWithData ? compWithData.data : null);                                                 // 60
                                                                                                        // 61
    } else if ((comp = findComponentWithHelper(id, self))) {                                            // 62
      // found a property or method of a component                                                      // 63
      // (`self` or one of its ancestors)                                                               // 64
      var result = comp[id];                                                                            // 65
                                                                                                        // 66
    } else if (_.has(builtInComponents, id)) {                                                          // 67
      return builtInComponents[id];                                                                     // 68
                                                                                                        // 69
    // Code to search the global namespace for capitalized names                                        // 70
    // like component classes, `Template`, `StringUtils.foo`,                                           // 71
    // etc.                                                                                             // 72
    //                                                                                                  // 73
    // } else if (/^[A-Z]/.test(id) && (id in global)) {                                                // 74
    //   // Only look for a global identifier if `id` is                                                // 75
    //   // capitalized.  This avoids having `{{name}}` mean                                            // 76
    //   // `window.name`.                                                                              // 77
    //   result = global[id];                                                                           // 78
    //   return function (/*arguments*/) {                                                              // 79
    //     var data = getComponentData(self);                                                           // 80
    //     if (typeof result === 'function')                                                            // 81
    //       return result.apply(data, arguments);                                                      // 82
    //     return result;                                                                               // 83
    //   };                                                                                             // 84
    } else if (template && _.has(Template, id)) {                                                       // 85
      return Template[id];                                                                              // 86
                                                                                                        // 87
    } else if ((result = UI._globalHelper(id))) {                                                       // 88
                                                                                                        // 89
    } else {                                                                                            // 90
      // Resolve id `foo` as `data.foo` (with a "soft dot").                                            // 91
      return function (/*arguments*/) {                                                                 // 92
        var data = getComponentData(self);                                                              // 93
        if (template && !(data && _.has(data, id)))                                                     // 94
          throw new Error("Can't find template, helper or data context key: " + id);                    // 95
        if (! data)                                                                                     // 96
          return data;                                                                                  // 97
        var result = data[id];                                                                          // 98
        if (typeof result === 'function')                                                               // 99
          return result.apply(data, arguments);                                                         // 100
        return result;                                                                                  // 101
      };                                                                                                // 102
    }                                                                                                   // 103
                                                                                                        // 104
    if (typeof result === 'function' && ! result._isEmboxedConstant) {                                  // 105
      // Wrap the function `result`, binding `this` to `getComponentData(self)`.                        // 106
      // This creates a dependency when the result function is called.                                  // 107
      // Don't do this if the function is really just an emboxed constant.                              // 108
      return function (/*arguments*/) {                                                                 // 109
        var data = getComponentData(self);                                                              // 110
        return result.apply(data === null ? {} : data, arguments);                                      // 111
      };                                                                                                // 112
    } else {                                                                                            // 113
      return result;                                                                                    // 114
    };                                                                                                  // 115
  },                                                                                                    // 116
  lookupTemplate: function (id) {                                                                       // 117
    return this.lookup(id, {template: true});                                                           // 118
  },                                                                                                    // 119
  get: function (id) {                                                                                  // 120
    // support `this.get()` to get the data context.                                                    // 121
    if (id === undefined)                                                                               // 122
      id = ".";                                                                                         // 123
                                                                                                        // 124
    var result = this.lookup(id);                                                                       // 125
    return (typeof result === 'function' ? result() : result);                                          // 126
  },                                                                                                    // 127
  set: function (id, value) {                                                                           // 128
    var comp = findComponentWithProp(id, this);                                                         // 129
    if (! comp || ! comp[id])                                                                           // 130
      throw new Error("Can't find field: " + id);                                                       // 131
    if (typeof comp[id] !== 'function')                                                                 // 132
      throw new Error("Not a settable field: " + id);                                                   // 133
    comp[id](value);                                                                                    // 134
  }                                                                                                     // 135
});                                                                                                     // 136
                                                                                                        // 137
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/ui/handlebars_backcompat.js                                                                 //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
// XXX this file no longer makes sense in isolation.  take it apart as                                  // 1
// part file reorg on the 'ui' package                                                                  // 2
var globalHelpers = {};                                                                                 // 3
                                                                                                        // 4
UI.registerHelper = function (name, func) {                                                             // 5
  globalHelpers[name] = func;                                                                           // 6
};                                                                                                      // 7
                                                                                                        // 8
UI._globalHelper = function (name) {                                                                    // 9
  return globalHelpers[name];                                                                           // 10
};                                                                                                      // 11
                                                                                                        // 12
Handlebars = {};                                                                                        // 13
Handlebars.registerHelper = UI.registerHelper;                                                          // 14
                                                                                                        // 15
// Utility to HTML-escape a string.                                                                     // 16
UI._escape = Handlebars._escape = (function() {                                                         // 17
  var escape_map = {                                                                                    // 18
    "<": "&lt;",                                                                                        // 19
    ">": "&gt;",                                                                                        // 20
    '"': "&quot;",                                                                                      // 21
    "'": "&#x27;",                                                                                      // 22
    "`": "&#x60;", /* IE allows backtick-delimited attributes?? */                                      // 23
    "&": "&amp;"                                                                                        // 24
  };                                                                                                    // 25
  var escape_one = function(c) {                                                                        // 26
    return escape_map[c];                                                                               // 27
  };                                                                                                    // 28
                                                                                                        // 29
  return function (x) {                                                                                 // 30
    return x.replace(/[&<>"'`]/g, escape_one);                                                          // 31
  };                                                                                                    // 32
})();                                                                                                   // 33
                                                                                                        // 34
// Return these from {{...}} helpers to achieve the same as returning                                   // 35
// strings from {{{...}}} helpers                                                                       // 36
Handlebars.SafeString = function(string) {                                                              // 37
  this.string = string;                                                                                 // 38
};                                                                                                      // 39
Handlebars.SafeString.prototype.toString = function() {                                                 // 40
  return this.string.toString();                                                                        // 41
};                                                                                                      // 42
                                                                                                        // 43
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.ui = {
  UI: UI,
  Handlebars: Handlebars
};

})();
