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
var Accounts = Package['accounts-base'].Accounts;
var SRP = Package.srp.SRP;
var _ = Package.underscore._;
var DDP = Package.livedata.DDP;

(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/accounts-password/password_client.js                                 //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// Attempt to log in with a password.                                            // 1
//                                                                               // 2
// @param selector {String|Object} One of the following:                         // 3
//   - {username: (username)}                                                    // 4
//   - {email: (email)}                                                          // 5
//   - a string which may be a username or email, depending on whether           // 6
//     it contains "@".                                                          // 7
// @param password {String}                                                      // 8
// @param callback {Function(error|undefined)}                                   // 9
Meteor.loginWithPassword = function (selector, password, callback) {             // 10
  var srp = new SRP.Client(password);                                            // 11
  var request = srp.startExchange();                                             // 12
                                                                                 // 13
  if (typeof selector === 'string')                                              // 14
    if (selector.indexOf('@') === -1)                                            // 15
      selector = {username: selector};                                           // 16
    else                                                                         // 17
      selector = {email: selector};                                              // 18
                                                                                 // 19
  request.user = selector;                                                       // 20
                                                                                 // 21
  // Normally, we only set Meteor.loggingIn() to true within                     // 22
  // Accounts.callLoginMethod, but we'd also like it to be true during the       // 23
  // password exchange. So we set it to true here, and clear it on error; in     // 24
  // the non-error case, it gets cleared by callLoginMethod.                     // 25
  Accounts._setLoggingIn(true);                                                  // 26
  Accounts.connection.apply(                                                     // 27
    'beginPasswordExchange', [request], function (error, result) {               // 28
      if (error || !result) {                                                    // 29
        Accounts._setLoggingIn(false);                                           // 30
        error = error ||                                                         // 31
          new Error("No result from call to beginPasswordExchange");             // 32
        callback && callback(error);                                             // 33
        return;                                                                  // 34
      }                                                                          // 35
                                                                                 // 36
      var response = srp.respondToChallenge(result);                             // 37
      Accounts.callLoginMethod({                                                 // 38
        methodArguments: [{srp: response}],                                      // 39
        validateResult: function (result) {                                      // 40
          if (!srp.verifyConfirmation({HAMK: result.HAMK}))                      // 41
            throw new Error("Server is cheating!");                              // 42
        },                                                                       // 43
        userCallback: callback});                                                // 44
    });                                                                          // 45
};                                                                               // 46
                                                                                 // 47
                                                                                 // 48
// Attempt to log in as a new user.                                              // 49
Accounts.createUser = function (options, callback) {                             // 50
  options = _.clone(options); // we'll be modifying options                      // 51
                                                                                 // 52
  if (!options.password)                                                         // 53
    throw new Error("Must set options.password");                                // 54
  var verifier = SRP.generateVerifier(options.password);                         // 55
  // strip old password, replacing with the verifier object                      // 56
  delete options.password;                                                       // 57
  options.srp = verifier;                                                        // 58
                                                                                 // 59
  Accounts.callLoginMethod({                                                     // 60
    methodName: 'createUser',                                                    // 61
    methodArguments: [options],                                                  // 62
    userCallback: callback                                                       // 63
  });                                                                            // 64
};                                                                               // 65
                                                                                 // 66
                                                                                 // 67
                                                                                 // 68
// Change password. Must be logged in.                                           // 69
//                                                                               // 70
// @param oldPassword {String|null} By default servers no longer allow           // 71
//   changing password without the old password, but they could so we            // 72
//   support passing no password to the server and letting it decide.            // 73
// @param newPassword {String}                                                   // 74
// @param callback {Function(error|undefined)}                                   // 75
Accounts.changePassword = function (oldPassword, newPassword, callback) {        // 76
  if (!Meteor.user()) {                                                          // 77
    callback && callback(new Error("Must be logged in to change password."));    // 78
    return;                                                                      // 79
  }                                                                              // 80
                                                                                 // 81
  var verifier = SRP.generateVerifier(newPassword);                              // 82
                                                                                 // 83
  if (!oldPassword) {                                                            // 84
    Accounts.connection.apply(                                                   // 85
      'changePassword', [{srp: verifier}], function (error, result) {            // 86
        if (error || !result) {                                                  // 87
          callback && callback(                                                  // 88
            error || new Error("No result from changePassword."));               // 89
        } else {                                                                 // 90
          callback && callback();                                                // 91
        }                                                                        // 92
      });                                                                        // 93
  } else { // oldPassword                                                        // 94
    var srp = new SRP.Client(oldPassword);                                       // 95
    var request = srp.startExchange();                                           // 96
    request.user = {id: Meteor.user()._id};                                      // 97
    Accounts.connection.apply(                                                   // 98
      'beginPasswordExchange', [request], function (error, result) {             // 99
        if (error || !result) {                                                  // 100
          callback && callback(                                                  // 101
            error || new Error("No result from call to beginPasswordExchange")); // 102
          return;                                                                // 103
        }                                                                        // 104
                                                                                 // 105
        var response = srp.respondToChallenge(result);                           // 106
        response.srp = verifier;                                                 // 107
        Accounts.connection.apply(                                               // 108
          'changePassword', [response],function (error, result) {                // 109
            if (error || !result) {                                              // 110
              callback && callback(                                              // 111
                error || new Error("No result from changePassword."));           // 112
            } else {                                                             // 113
              if (!srp.verifyConfirmation(result)) {                             // 114
                // Monkey business!                                              // 115
                callback &&                                                      // 116
                  callback(new Error("Old password verification failed."));      // 117
              } else {                                                           // 118
                callback && callback();                                          // 119
              }                                                                  // 120
            }                                                                    // 121
          });                                                                    // 122
      });                                                                        // 123
  }                                                                              // 124
};                                                                               // 125
                                                                                 // 126
// Sends an email to a user with a link that can be used to reset                // 127
// their password                                                                // 128
//                                                                               // 129
// @param options {Object}                                                       // 130
//   - email: (email)                                                            // 131
// @param callback (optional) {Function(error|undefined)}                        // 132
Accounts.forgotPassword = function(options, callback) {                          // 133
  if (!options.email)                                                            // 134
    throw new Error("Must pass options.email");                                  // 135
  Accounts.connection.call("forgotPassword", options, callback);                 // 136
};                                                                               // 137
                                                                                 // 138
// Resets a password based on a token originally created by                      // 139
// Accounts.forgotPassword, and then logs in the matching user.                  // 140
//                                                                               // 141
// @param token {String}                                                         // 142
// @param newPassword {String}                                                   // 143
// @param callback (optional) {Function(error|undefined)}                        // 144
Accounts.resetPassword = function(token, newPassword, callback) {                // 145
  if (!token)                                                                    // 146
    throw new Error("Need to pass token");                                       // 147
  if (!newPassword)                                                              // 148
    throw new Error("Need to pass newPassword");                                 // 149
                                                                                 // 150
  var verifier = SRP.generateVerifier(newPassword);                              // 151
  Accounts.callLoginMethod({                                                     // 152
    methodName: 'resetPassword',                                                 // 153
    methodArguments: [token, verifier],                                          // 154
    userCallback: callback});                                                    // 155
};                                                                               // 156
                                                                                 // 157
// Verifies a user's email address based on a token originally                   // 158
// created by Accounts.sendVerificationEmail                                     // 159
//                                                                               // 160
// @param token {String}                                                         // 161
// @param callback (optional) {Function(error|undefined)}                        // 162
Accounts.verifyEmail = function(token, callback) {                               // 163
  if (!token)                                                                    // 164
    throw new Error("Need to pass token");                                       // 165
                                                                                 // 166
  Accounts.callLoginMethod({                                                     // 167
    methodName: 'verifyEmail',                                                   // 168
    methodArguments: [token],                                                    // 169
    userCallback: callback});                                                    // 170
};                                                                               // 171
                                                                                 // 172
///////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['accounts-password'] = {};

})();

//# sourceMappingURL=7f6e34b4d1163d4f00553d0c81660aa79dcf9b89.map
