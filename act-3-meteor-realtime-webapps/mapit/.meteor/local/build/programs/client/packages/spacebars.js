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
var HTML = Package.htmljs.HTML;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;

/* Package-scope variables */
var Spacebars;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/spacebars/spacebars-runtime.js                                                                  //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
Spacebars = {};                                                                                             // 1
                                                                                                            // 2
// * `templateOrFunction` - template (component) or function returning a template                           // 3
// or null                                                                                                  // 4
Spacebars.include = function (templateOrFunction, contentBlock, elseContentBlock) {                         // 5
  if (contentBlock && ! UI.isComponent(contentBlock))                                                       // 6
    throw new Error('Second argument to Spacebars.include must be a template or UI.block if present');      // 7
  if (elseContentBlock && ! UI.isComponent(elseContentBlock))                                               // 8
    throw new Error('Third argument to Spacebars.include must be a template or UI.block if present');       // 9
                                                                                                            // 10
  var props = null;                                                                                         // 11
  if (contentBlock) {                                                                                       // 12
    props = (props || {});                                                                                  // 13
    props.__content = contentBlock;                                                                         // 14
  }                                                                                                         // 15
  if (elseContentBlock) {                                                                                   // 16
    props = (props || {});                                                                                  // 17
    props.__elseContent = elseContentBlock;                                                                 // 18
  }                                                                                                         // 19
                                                                                                            // 20
  if (UI.isComponent(templateOrFunction))                                                                   // 21
    return templateOrFunction.extend(props);                                                                // 22
                                                                                                            // 23
  var func = templateOrFunction;                                                                            // 24
                                                                                                            // 25
  var f = function () {                                                                                     // 26
    var emboxedFunc = UI.namedEmboxValue('Spacebars.include', func);                                        // 27
    f.stop = function () {                                                                                  // 28
      emboxedFunc.stop();                                                                                   // 29
    };                                                                                                      // 30
    var tmpl = emboxedFunc();                                                                               // 31
                                                                                                            // 32
    if (tmpl === null)                                                                                      // 33
      return null;                                                                                          // 34
    if (! UI.isComponent(tmpl))                                                                             // 35
      throw new Error("Expected null or template in return value from inclusion function, found: " + tmpl); // 36
                                                                                                            // 37
    return tmpl.extend(props);                                                                              // 38
  };                                                                                                        // 39
                                                                                                            // 40
  return f;                                                                                                 // 41
};                                                                                                          // 42
                                                                                                            // 43
// Executes `{{foo bar baz}}` when called on `(foo, bar, baz)`.                                             // 44
// If `bar` and `baz` are functions, they are called before                                                 // 45
// `foo` is called on them.                                                                                 // 46
//                                                                                                          // 47
// This is the shared part of Spacebars.mustache and                                                        // 48
// Spacebars.attrMustache, which differ in how they post-process the                                        // 49
// result.                                                                                                  // 50
Spacebars.mustacheImpl = function (value/*, args*/) {                                                       // 51
  var args = arguments;                                                                                     // 52
  // if we have any arguments (pos or kw), add an options argument                                          // 53
  // if there isn't one.                                                                                    // 54
  if (args.length > 1) {                                                                                    // 55
    var kw = args[args.length - 1];                                                                         // 56
    if (! (kw instanceof Spacebars.kw)) {                                                                   // 57
      kw = Spacebars.kw();                                                                                  // 58
      // clone arguments into an actual array, then push                                                    // 59
      // the empty kw object.                                                                               // 60
      args = Array.prototype.slice.call(arguments);                                                         // 61
      args.push(kw);                                                                                        // 62
    } else {                                                                                                // 63
      // For each keyword arg, call it if it's a function                                                   // 64
      var newHash = {};                                                                                     // 65
      for (var k in kw.hash) {                                                                              // 66
        var v = kw.hash[k];                                                                                 // 67
        newHash[k] = (typeof v === 'function' ? v() : v);                                                   // 68
      }                                                                                                     // 69
      args[args.length - 1] = Spacebars.kw(newHash);                                                        // 70
    }                                                                                                       // 71
  }                                                                                                         // 72
                                                                                                            // 73
  return Spacebars.call.apply(null, args);                                                                  // 74
};                                                                                                          // 75
                                                                                                            // 76
Spacebars.mustache = function (value/*, args*/) {                                                           // 77
  var result = Spacebars.mustacheImpl.apply(null, arguments);                                               // 78
                                                                                                            // 79
  if (result instanceof Spacebars.SafeString)                                                               // 80
    return HTML.Raw(result.toString());                                                                     // 81
  else                                                                                                      // 82
    // map `null`, `undefined`, and `false` to null, which is important                                     // 83
    // so that attributes with nully values are considered absent.                                          // 84
    // stringify anything else (e.g. strings, booleans, numbers including 0).                               // 85
    return (result == null || result === false) ? null : String(result);                                    // 86
};                                                                                                          // 87
                                                                                                            // 88
Spacebars.attrMustache = function (value/*, args*/) {                                                       // 89
  var result = Spacebars.mustacheImpl.apply(null, arguments);                                               // 90
                                                                                                            // 91
  if (result == null || result === '') {                                                                    // 92
    return null;                                                                                            // 93
  } else if (typeof result === 'object') {                                                                  // 94
    return result;                                                                                          // 95
  } else if (typeof result === 'string' && HTML.isValidAttributeName(result)) {                             // 96
    var obj = {};                                                                                           // 97
    obj[result] = '';                                                                                       // 98
    return obj;                                                                                             // 99
  } else {                                                                                                  // 100
    throw new Error("Expected valid attribute name, '', null, or object");                                  // 101
  }                                                                                                         // 102
};                                                                                                          // 103
                                                                                                            // 104
Spacebars.dataMustache = function (value/*, args*/) {                                                       // 105
  var result = Spacebars.mustacheImpl.apply(null, arguments);                                               // 106
                                                                                                            // 107
  return result;                                                                                            // 108
};                                                                                                          // 109
                                                                                                            // 110
// Idempotently wrap in `HTML.Raw`.                                                                         // 111
//                                                                                                          // 112
// Called on the return value from `Spacebars.mustache` in case the                                         // 113
// template uses triple-stache (`{{{foo bar baz}}}`).                                                       // 114
Spacebars.makeRaw = function (value) {                                                                      // 115
  if (value == null) // null or undefined                                                                   // 116
    return null;                                                                                            // 117
  else if (value instanceof HTML.Raw)                                                                       // 118
    return value;                                                                                           // 119
  else                                                                                                      // 120
    return HTML.Raw(value);                                                                                 // 121
};                                                                                                          // 122
                                                                                                            // 123
// If `value` is a function, called it on the `args`, after                                                 // 124
// evaluating the args themselves (by calling them if they are                                              // 125
// functions).  Otherwise, simply return `value` (and assert that                                           // 126
// there are no args).                                                                                      // 127
Spacebars.call = function (value/*, args*/) {                                                               // 128
  if (typeof value === 'function') {                                                                        // 129
    // evaluate arguments if they are functions (by calling them)                                           // 130
    var newArgs = [];                                                                                       // 131
    for (var i = 1; i < arguments.length; i++) {                                                            // 132
      var arg = arguments[i];                                                                               // 133
      newArgs[i-1] = (typeof arg === 'function' ? arg() : arg);                                             // 134
    }                                                                                                       // 135
                                                                                                            // 136
    return value.apply(null, newArgs);                                                                      // 137
  } else {                                                                                                  // 138
    if (arguments.length > 1)                                                                               // 139
      throw new Error("Can't call non-function: " + value);                                                 // 140
                                                                                                            // 141
    return value;                                                                                           // 142
  }                                                                                                         // 143
};                                                                                                          // 144
                                                                                                            // 145
// Call this as `Spacebars.kw({ ... })`.  The return value                                                  // 146
// is `instanceof Spacebars.kw`.                                                                            // 147
Spacebars.kw = function (hash) {                                                                            // 148
  if (! (this instanceof Spacebars.kw))                                                                     // 149
    // called without new; call with new                                                                    // 150
    return new Spacebars.kw(hash);                                                                          // 151
                                                                                                            // 152
  this.hash = hash || {};                                                                                   // 153
};                                                                                                          // 154
                                                                                                            // 155
// Call this as `Spacebars.SafeString("some HTML")`.  The return value                                      // 156
// is `instanceof Spacebars.SafeString` (and `instanceof Handlebars.SafeString).                            // 157
Spacebars.SafeString = function (html) {                                                                    // 158
  if (! (this instanceof Spacebars.SafeString))                                                             // 159
    // called without new; call with new                                                                    // 160
    return new Spacebars.SafeString(html);                                                                  // 161
                                                                                                            // 162
  return new Handlebars.SafeString(html);                                                                   // 163
};                                                                                                          // 164
Spacebars.SafeString.prototype = Handlebars.SafeString.prototype;                                           // 165
                                                                                                            // 166
// `Spacebars.dot(foo, "bar", "baz")` performs a special kind                                               // 167
// of `foo.bar.baz` that allows safe indexing of `null` and                                                 // 168
// indexing of functions (which calls the function).  If the                                                // 169
// result is a function, it is always a bound function (e.g.                                                // 170
// a wrapped version of `baz` that always uses `foo.bar` as                                                 // 171
// `this`).                                                                                                 // 172
//                                                                                                          // 173
// In `Spacebars.dot(foo, "bar")`, `foo` is assumed to be either                                            // 174
// a non-function value or a "fully-bound" function wrapping a value,                                       // 175
// where fully-bound means it takes no arguments and ignores `this`.                                        // 176
//                                                                                                          // 177
// `Spacebars.dot(foo, "bar")` performs the following steps:                                                // 178
//                                                                                                          // 179
// * If `foo` is falsy, return `foo`.                                                                       // 180
//                                                                                                          // 181
// * If `foo` is a function, call it (set `foo` to `foo()`).                                                // 182
//                                                                                                          // 183
// * If `foo` is falsy now, return `foo`.                                                                   // 184
//                                                                                                          // 185
// * Return `foo.bar`, binding it to `foo` if it's a function.                                              // 186
Spacebars.dot = function (value, id1/*, id2, ...*/) {                                                       // 187
  if (arguments.length > 2) {                                                                               // 188
    // Note: doing this recursively is probably less efficient than                                         // 189
    // doing it in an iterative loop.                                                                       // 190
    var argsForRecurse = [];                                                                                // 191
    argsForRecurse.push(Spacebars.dot(value, id1));                                                         // 192
    argsForRecurse.push.apply(argsForRecurse,                                                               // 193
                              Array.prototype.slice.call(arguments, 2));                                    // 194
    return Spacebars.dot.apply(null, argsForRecurse);                                                       // 195
  }                                                                                                         // 196
                                                                                                            // 197
  if (typeof value === 'function')                                                                          // 198
    value = value();                                                                                        // 199
                                                                                                            // 200
  if (! value)                                                                                              // 201
    return value; // falsy, don't index, pass through                                                       // 202
                                                                                                            // 203
  var result = value[id1];                                                                                  // 204
  if (typeof result !== 'function')                                                                         // 205
    return result;                                                                                          // 206
  // `value[id1]` (or `value()[id1]`) is a function.                                                        // 207
  // Bind it so that when called, `value` will be placed in `this`.                                         // 208
  return function (/*arguments*/) {                                                                         // 209
    return result.apply(value, arguments);                                                                  // 210
  };                                                                                                        // 211
};                                                                                                          // 212
                                                                                                            // 213
// Implement Spacebars's #with, which renders its else case (or nothing)                                    // 214
// if the argument is falsy.                                                                                // 215
Spacebars.With = function (argFunc, contentBlock, elseContentBlock) {                                       // 216
  return UI.Component.extend({                                                                              // 217
    init: function () {                                                                                     // 218
      this.v = UI.emboxValue(argFunc, UI.safeEquals);                                                       // 219
    },                                                                                                      // 220
    render: function () {                                                                                   // 221
      return UI.If(this.v, UI.With(this.v, contentBlock), elseContentBlock);                                // 222
    },                                                                                                      // 223
    materialized: (function () {                                                                            // 224
      var f = function () {                                                                                 // 225
        var self = this;                                                                                    // 226
        if (Deps.active) {                                                                                  // 227
          Deps.onInvalidate(function () {                                                                   // 228
            self.v.stop();                                                                                  // 229
          });                                                                                               // 230
        }                                                                                                   // 231
      };                                                                                                    // 232
      f.isWith = true;                                                                                      // 233
      return f;                                                                                             // 234
    })()                                                                                                    // 235
  });                                                                                                       // 236
};                                                                                                          // 237
                                                                                                            // 238
Spacebars.TemplateWith = function (argFunc, contentBlock) {                                                 // 239
  var w = UI.With(argFunc, contentBlock);                                                                   // 240
  w.__isTemplateWith = true;                                                                                // 241
  return w;                                                                                                 // 242
};                                                                                                          // 243
                                                                                                            // 244
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.spacebars = {
  Spacebars: Spacebars
};

})();

//# sourceMappingURL=f49560fc90a8d71b7637d9596696078881b8c812.map
