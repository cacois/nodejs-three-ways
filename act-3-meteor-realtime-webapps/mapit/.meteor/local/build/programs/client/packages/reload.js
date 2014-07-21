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
var Log = Package.logging.Log;
var JSON = Package.json.JSON;

/* Package-scope variables */
var Reload;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                           //
// packages/reload/reload.js                                                                 //
//                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////
                                                                                             //
/**                                                                                          // 1
 * This code does _NOT_ support hot (session-restoring) reloads on                           // 2
 * IE6,7. It only works on browsers with sessionStorage support.                             // 3
 *                                                                                           // 4
 * There are a couple approaches to add IE6,7 support:                                       // 5
 *                                                                                           // 6
 * - use IE's "userData" mechanism in combination with window.name.                          // 7
 * This mostly works, however the problem is that it can not get to the                      // 8
 * data until after DOMReady. This is a problem for us since this API                        // 9
 * relies on the data being ready before API users run. We could                             // 10
 * refactor using Meteor.startup in all API users, but that might slow                       // 11
 * page loads as we couldn't start the stream until after DOMReady.                          // 12
 * Here are some resources on this approach:                                                 // 13
 * https://github.com/hugeinc/USTORE.js                                                      // 14
 * http://thudjs.tumblr.com/post/419577524/localstorage-userdata                             // 15
 * http://www.javascriptkit.com/javatutors/domstorage2.shtml                                 // 16
 *                                                                                           // 17
 * - POST the data to the server, and have the server send it back on                        // 18
 * page load. This is nice because it sidesteps all the local storage                        // 19
 * compatibility issues, however it is kinda tricky. We can use a unique                     // 20
 * token in the URL, then get rid of it with HTML5 pushstate, but that                       // 21
 * only works on pushstate browsers.                                                         // 22
 *                                                                                           // 23
 * This will all need to be reworked entirely when we add server-side                        // 24
 * HTML rendering. In that case, the server will need to have access to                      // 25
 * the client's session to render properly.                                                  // 26
 */                                                                                          // 27
                                                                                             // 28
// XXX when making this API public, also expose a flag for the app                           // 29
// developer to know whether a hot code push is happening. This is                           // 30
// useful for apps using `window.onbeforeunload`. See                                        // 31
// https://github.com/meteor/meteor/pull/657                                                 // 32
                                                                                             // 33
var KEY_NAME = 'Meteor_Reload';                                                              // 34
// after how long should we consider this no longer an automatic                             // 35
// reload, but a fresh restart. This only happens if a reload is                             // 36
// interrupted and a user manually restarts things. The only time                            // 37
// this is really weird is if a user navigates away mid-refresh,                             // 38
// then manually navigates back to the page.                                                 // 39
var TIMEOUT = 30000;                                                                         // 40
                                                                                             // 41
                                                                                             // 42
var old_data = {};                                                                           // 43
// read in old data at startup.                                                              // 44
var old_json;                                                                                // 45
// On Firefox with dom.storage.enabled set to false, sessionStorage is null,                 // 46
// so we have to both check to see if it is defined and not null.                            // 47
if (typeof sessionStorage !== "undefined" && sessionStorage) {                               // 48
  old_json = sessionStorage.getItem(KEY_NAME);                                               // 49
  sessionStorage.removeItem(KEY_NAME);                                                       // 50
} else {                                                                                     // 51
  // Unsupported browser (IE 6,7). No session resumption.                                    // 52
  // Meteor._debug("XXX UNSUPPORTED BROWSER");                                               // 53
}                                                                                            // 54
                                                                                             // 55
if (!old_json) old_json = '{}';                                                              // 56
var old_parsed = {};                                                                         // 57
try {                                                                                        // 58
  old_parsed = JSON.parse(old_json);                                                         // 59
  if (typeof old_parsed !== "object") {                                                      // 60
    Meteor._debug("Got bad data on reload. Ignoring.");                                      // 61
    old_parsed = {};                                                                         // 62
  }                                                                                          // 63
} catch (err) {                                                                              // 64
  Meteor._debug("Got invalid JSON on reload. Ignoring.");                                    // 65
}                                                                                            // 66
                                                                                             // 67
if (old_parsed.reload && typeof old_parsed.data === "object" &&                              // 68
    old_parsed.time + TIMEOUT > (new Date()).getTime()) {                                    // 69
  // Meteor._debug("Restoring reload data.");                                                // 70
  old_data = old_parsed.data;                                                                // 71
}                                                                                            // 72
                                                                                             // 73
                                                                                             // 74
var providers = [];                                                                          // 75
                                                                                             // 76
////////// External API //////////                                                           // 77
                                                                                             // 78
Reload = {};                                                                                 // 79
                                                                                             // 80
// Packages that support migration should register themselves by                             // 81
// calling this function. When it's time to migrate, callback will                           // 82
// be called with one argument, the "retry function." If the package                         // 83
// is ready to migrate, it should return [true, data], where data is                         // 84
// its migration data, an arbitrary JSON value (or [true] if it has                          // 85
// no migration data this time). If the package needs more time                              // 86
// before it is ready to migrate, it should return false. Then, once                         // 87
// it is ready to migrating again, it should call the retry                                  // 88
// function. The retry function will return immediately, but will                            // 89
// schedule the migration to be retried, meaning that every package                          // 90
// will be polled once again for its migration data. If they are all                         // 91
// ready this time, then the migration will happen. name must be set if there                // 92
// is migration data.                                                                        // 93
//                                                                                           // 94
Reload._onMigrate = function (name, callback) {                                              // 95
  if (!callback) {                                                                           // 96
    // name not provided, so first arg is callback.                                          // 97
    callback = name;                                                                         // 98
    name = undefined;                                                                        // 99
  }                                                                                          // 100
  providers.push({name: name, callback: callback});                                          // 101
};                                                                                           // 102
                                                                                             // 103
// Called by packages when they start up.                                                    // 104
// Returns the object that was saved, or undefined if none saved.                            // 105
//                                                                                           // 106
Reload._migrationData = function (name) {                                                    // 107
  return old_data[name];                                                                     // 108
};                                                                                           // 109
                                                                                             // 110
// Migrating reload: reload this page (presumably to pick up a new                           // 111
// version of the code or assets), but save the program state and                            // 112
// migrate it over. This function returns immediately. The reload                            // 113
// will happen at some point in the future once all of the packages                          // 114
// are ready to migrate.                                                                     // 115
//                                                                                           // 116
var reloading = false;                                                                       // 117
Reload._reload = function () {                                                               // 118
  if (reloading)                                                                             // 119
    return;                                                                                  // 120
  reloading = true;                                                                          // 121
                                                                                             // 122
  var tryReload = function () { _.defer(function () {                                        // 123
    // Make sure each package is ready to go, and collect their                              // 124
    // migration data                                                                        // 125
    var migrationData = {};                                                                  // 126
    var remaining = _.clone(providers);                                                      // 127
    while (remaining.length) {                                                               // 128
      var p = remaining.shift();                                                             // 129
      var status = p.callback(tryReload);                                                    // 130
      if (!status[0])                                                                        // 131
        return; // not ready yet..                                                           // 132
      if (status.length > 1 && p.name)                                                       // 133
        migrationData[p.name] = status[1];                                                   // 134
    };                                                                                       // 135
                                                                                             // 136
    try {                                                                                    // 137
      // Persist the migration data                                                          // 138
      var json = JSON.stringify({                                                            // 139
        time: (new Date()).getTime(), data: migrationData, reload: true                      // 140
      });                                                                                    // 141
    } catch (err) {                                                                          // 142
      Meteor._debug("Couldn't serialize data for migration", migrationData);                 // 143
      throw err;                                                                             // 144
    }                                                                                        // 145
                                                                                             // 146
    if (typeof sessionStorage !== "undefined" && sessionStorage) {                           // 147
      try {                                                                                  // 148
        sessionStorage.setItem(KEY_NAME, json);                                              // 149
      } catch (err) {                                                                        // 150
        // happens in safari with private browsing                                           // 151
        Meteor._debug("Couldn't save data for migration to sessionStorage", err);            // 152
      }                                                                                      // 153
    } else {                                                                                 // 154
      Meteor._debug("Browser does not support sessionStorage. Not saving migration state."); // 155
    }                                                                                        // 156
                                                                                             // 157
    // Tell the browser to shut down this VM and make a new one                              // 158
    window.location.reload();                                                                // 159
  }); };                                                                                     // 160
                                                                                             // 161
  tryReload();                                                                               // 162
};                                                                                           // 163
                                                                                             // 164
///////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                           //
// packages/reload/deprecated.js                                                             //
//                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////
                                                                                             //
// Reload functionality used to live on Meteor._reload. Be nice and try not to               // 1
// break code that uses it, even though it's internal.                                       // 2
// XXX COMPAT WITH 0.6.4                                                                     // 3
Meteor._reload = {                                                                           // 4
  onMigrate: Reload._onMigrate,                                                              // 5
  migrationData: Reload._migrationData,                                                      // 6
  reload: Reload._reload                                                                     // 7
};                                                                                           // 8
                                                                                             // 9
///////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.reload = {
  Reload: Reload
};

})();

//# sourceMappingURL=ad0e94b5b63bbe79ab30e9dad4e6eb91694f5875.map
