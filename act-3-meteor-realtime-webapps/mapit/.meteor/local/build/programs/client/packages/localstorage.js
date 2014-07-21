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
var Random = Package.random.Random;

(function () {

/////////////////////////////////////////////////////////////////////////////////
//                                                                             //
// packages/localstorage/localstorage.js                                       //
//                                                                             //
/////////////////////////////////////////////////////////////////////////////////
                                                                               //
// Meteor._localStorage is not an ideal name, but we can change it later.      // 1
                                                                               // 2
if (window.localStorage) {                                                     // 3
  // Let's test to make sure that localStorage actually works. For example, in // 4
  // Safari with private browsing on, window.localStorage exists but actually  // 5
  // trying to use it throws.                                                  // 6
                                                                               // 7
  var key = '_localstorage_test_' + Random.id();                               // 8
  var retrieved;                                                               // 9
  try {                                                                        // 10
    window.localStorage.setItem(key, key);                                     // 11
    retrieved = window.localStorage.getItem(key);                              // 12
    window.localStorage.removeItem(key);                                       // 13
  } catch (e) {                                                                // 14
    // ... ignore                                                              // 15
  }                                                                            // 16
  if (key === retrieved) {                                                     // 17
    Meteor._localStorage = {                                                   // 18
      getItem: function (key) {                                                // 19
        return window.localStorage.getItem(key);                               // 20
      },                                                                       // 21
      setItem: function (key, value) {                                         // 22
        window.localStorage.setItem(key, value);                               // 23
      },                                                                       // 24
      removeItem: function (key) {                                             // 25
        window.localStorage.removeItem(key);                                   // 26
      }                                                                        // 27
    };                                                                         // 28
  }                                                                            // 29
}                                                                              // 30
                                                                               // 31
if (!Meteor._localStorage) {                                                   // 32
  Meteor._debug(                                                               // 33
    "You are running a browser with no localStorage or userData "              // 34
      + "support. Logging in from one tab will not cause another "             // 35
      + "tab to be logged in.");                                               // 36
                                                                               // 37
  Meteor._localStorage = {                                                     // 38
    _data: {},                                                                 // 39
                                                                               // 40
    setItem: function (key, val) {                                             // 41
      this._data[key] = val;                                                   // 42
    },                                                                         // 43
    removeItem: function (key) {                                               // 44
      delete this._data[key];                                                  // 45
    },                                                                         // 46
    getItem: function (key) {                                                  // 47
      var value = this._data[key];                                             // 48
      if (value === undefined)                                                 // 49
        return null;                                                           // 50
      else                                                                     // 51
        return value;                                                          // 52
    }                                                                          // 53
  };                                                                           // 54
}                                                                              // 55
                                                                               // 56
/////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.localstorage = {};

})();

//# sourceMappingURL=5e0935b5400fc4b2fe50a44086afc939e63063dc.map
