(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Hook = Package['callback-hook'].Hook;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var MongoInternals = Package['mongo-livedata'].MongoInternals;

/* Package-scope variables */
var Accounts, EXPIRE_TOKENS_INTERVAL_MS, CONNECTION_CLOSE_DELAY_MS, getTokenLifetimeMs, maybeStopExpireTokensInterval;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/accounts-base/accounts_common.js                                                                     //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
Accounts = {};                                                                                                   // 1
                                                                                                                 // 2
// Currently this is read directly by packages like accounts-password                                            // 3
// and accounts-ui-unstyled.                                                                                     // 4
Accounts._options = {};                                                                                          // 5
                                                                                                                 // 6
// how long (in days) until a login token expires                                                                // 7
var DEFAULT_LOGIN_EXPIRATION_DAYS = 90;                                                                          // 8
// Clients don't try to auto-login with a token that is going to expire within                                   // 9
// .1 * DEFAULT_LOGIN_EXPIRATION_DAYS, capped at MIN_TOKEN_LIFETIME_CAP_SECS.                                    // 10
// Tries to avoid abrupt disconnects from expiring tokens.                                                       // 11
var MIN_TOKEN_LIFETIME_CAP_SECS = 3600; // one hour                                                              // 12
// how often (in milliseconds) we check for expired tokens                                                       // 13
EXPIRE_TOKENS_INTERVAL_MS = 600 * 1000; // 10 minutes                                                            // 14
// how long we wait before logging out clients when Meteor.logoutOtherClients is                                 // 15
// called                                                                                                        // 16
CONNECTION_CLOSE_DELAY_MS = 10 * 1000;                                                                           // 17
                                                                                                                 // 18
// Set up config for the accounts system. Call this on both the client                                           // 19
// and the server.                                                                                               // 20
//                                                                                                               // 21
// XXX we should add some enforcement that this is called on both the                                            // 22
// client and the server. Otherwise, a user can                                                                  // 23
// 'forbidClientAccountCreation' only on the client and while it looks                                           // 24
// like their app is secure, the server will still accept createUser                                             // 25
// calls. https://github.com/meteor/meteor/issues/828                                                            // 26
//                                                                                                               // 27
// @param options {Object} an object with fields:                                                                // 28
// - sendVerificationEmail {Boolean}                                                                             // 29
//     Send email address verification emails to new users created from                                          // 30
//     client signups.                                                                                           // 31
// - forbidClientAccountCreation {Boolean}                                                                       // 32
//     Do not allow clients to create accounts directly.                                                         // 33
// - restrictCreationByEmailDomain {Function or String}                                                          // 34
//     Require created users to have an email matching the function or                                           // 35
//     having the string as domain.                                                                              // 36
// - loginExpirationInDays {Number}                                                                              // 37
//     Number of days since login until a user is logged out (login token                                        // 38
//     expires).                                                                                                 // 39
//                                                                                                               // 40
Accounts.config = function(options) {                                                                            // 41
  // We don't want users to accidentally only call Accounts.config on the                                        // 42
  // client, where some of the options will have partial effects (eg removing                                    // 43
  // the "create account" button from accounts-ui if forbidClientAccountCreation                                 // 44
  // is set, or redirecting Google login to a specific-domain page) without                                      // 45
  // having their full effects.                                                                                  // 46
  if (Meteor.isServer) {                                                                                         // 47
    __meteor_runtime_config__.accountsConfigCalled = true;                                                       // 48
  } else if (!__meteor_runtime_config__.accountsConfigCalled) {                                                  // 49
    // XXX would be nice to "crash" the client and replace the UI with an error                                  // 50
    // message, but there's no trivial way to do this.                                                           // 51
    Meteor._debug("Accounts.config was called on the client but not on the " +                                   // 52
                  "server; some configuration options may not take effect.");                                    // 53
  }                                                                                                              // 54
                                                                                                                 // 55
  // We need to validate the oauthSecretKey option at the time                                                   // 56
  // Accounts.config is called. We also deliberately don't store the                                             // 57
  // oauthSecretKey in Accounts._options.                                                                        // 58
  if (_.has(options, "oauthSecretKey")) {                                                                        // 59
    if (Meteor.isClient)                                                                                         // 60
      throw new Error("The oauthSecretKey option may only be specified on the server");                          // 61
    if (! Package["oauth-encryption"])                                                                           // 62
      throw new Error("The oauth-encryption package must be loaded to set oauthSecretKey");                      // 63
    Package["oauth-encryption"].OAuthEncryption.loadKey(options.oauthSecretKey);                                 // 64
    options = _.omit(options, "oauthSecretKey");                                                                 // 65
  }                                                                                                              // 66
                                                                                                                 // 67
  // validate option keys                                                                                        // 68
  var VALID_KEYS = ["sendVerificationEmail", "forbidClientAccountCreation",                                      // 69
                    "restrictCreationByEmailDomain", "loginExpirationInDays"];                                   // 70
  _.each(_.keys(options), function (key) {                                                                       // 71
    if (!_.contains(VALID_KEYS, key)) {                                                                          // 72
      throw new Error("Accounts.config: Invalid key: " + key);                                                   // 73
    }                                                                                                            // 74
  });                                                                                                            // 75
                                                                                                                 // 76
  // set values in Accounts._options                                                                             // 77
  _.each(VALID_KEYS, function (key) {                                                                            // 78
    if (key in options) {                                                                                        // 79
      if (key in Accounts._options) {                                                                            // 80
        throw new Error("Can't set `" + key + "` more than once");                                               // 81
      } else {                                                                                                   // 82
        Accounts._options[key] = options[key];                                                                   // 83
      }                                                                                                          // 84
    }                                                                                                            // 85
  });                                                                                                            // 86
                                                                                                                 // 87
  // If the user set loginExpirationInDays to null, then we need to clear the                                    // 88
  // timer that periodically expires tokens.                                                                     // 89
  if (Meteor.isServer)                                                                                           // 90
    maybeStopExpireTokensInterval();                                                                             // 91
};                                                                                                               // 92
                                                                                                                 // 93
if (Meteor.isClient) {                                                                                           // 94
  // The connection used by the Accounts system. This is the connection                                          // 95
  // that will get logged in by Meteor.login(), and this is the                                                  // 96
  // connection whose login state will be reflected by Meteor.userId().                                          // 97
  //                                                                                                             // 98
  // It would be much preferable for this to be in accounts_client.js,                                           // 99
  // but it has to be here because it's needed to create the                                                     // 100
  // Meteor.users collection.                                                                                    // 101
  Accounts.connection = Meteor.connection;                                                                       // 102
                                                                                                                 // 103
  if (typeof __meteor_runtime_config__ !== "undefined" &&                                                        // 104
      __meteor_runtime_config__.ACCOUNTS_CONNECTION_URL) {                                                       // 105
    // Temporary, internal hook to allow the server to point the client                                          // 106
    // to a different authentication server. This is for a very                                                  // 107
    // particular use case that comes up when implementing a oauth                                               // 108
    // server. Unsupported and may go away at any point in time.                                                 // 109
    //                                                                                                           // 110
    // We will eventually provide a general way to use account-base                                              // 111
    // against any DDP connection, not just one special one.                                                     // 112
    Accounts.connection = DDP.connect(                                                                           // 113
      __meteor_runtime_config__.ACCOUNTS_CONNECTION_URL)                                                         // 114
  }                                                                                                              // 115
}                                                                                                                // 116
                                                                                                                 // 117
// Users table. Don't use the normal autopublish, since we want to hide                                          // 118
// some fields. Code to autopublish this is in accounts_server.js.                                               // 119
// XXX Allow users to configure this collection name.                                                            // 120
//                                                                                                               // 121
Meteor.users = new Meteor.Collection("users", {                                                                  // 122
  _preventAutopublish: true,                                                                                     // 123
  connection: Meteor.isClient ? Accounts.connection : Meteor.connection                                          // 124
});                                                                                                              // 125
// There is an allow call in accounts_server that restricts this                                                 // 126
// collection.                                                                                                   // 127
                                                                                                                 // 128
// loginServiceConfiguration and ConfigError are maintained for backwards compatibility                          // 129
Meteor.startup(function () {                                                                                     // 130
  var ServiceConfiguration =                                                                                     // 131
    Package['service-configuration'].ServiceConfiguration;                                                       // 132
  Accounts.loginServiceConfiguration = ServiceConfiguration.configurations;                                      // 133
  Accounts.ConfigError = ServiceConfiguration.ConfigError;                                                       // 134
});                                                                                                              // 135
                                                                                                                 // 136
// Thrown when the user cancels the login process (eg, closes an oauth                                           // 137
// popup, declines retina scan, etc)                                                                             // 138
Accounts.LoginCancelledError = function(description) {                                                           // 139
  this.message = description;                                                                                    // 140
};                                                                                                               // 141
                                                                                                                 // 142
// This is used to transmit specific subclass errors over the wire. We should                                    // 143
// come up with a more generic way to do this (eg, with some sort of symbolic                                    // 144
// error code rather than a number).                                                                             // 145
Accounts.LoginCancelledError.numericError = 0x8acdc2f;                                                           // 146
Accounts.LoginCancelledError.prototype = new Error();                                                            // 147
Accounts.LoginCancelledError.prototype.name = 'Accounts.LoginCancelledError';                                    // 148
                                                                                                                 // 149
getTokenLifetimeMs = function () {                                                                               // 150
  return (Accounts._options.loginExpirationInDays ||                                                             // 151
          DEFAULT_LOGIN_EXPIRATION_DAYS) * 24 * 60 * 60 * 1000;                                                  // 152
};                                                                                                               // 153
                                                                                                                 // 154
Accounts._tokenExpiration = function (when) {                                                                    // 155
  // We pass when through the Date constructor for backwards compatibility;                                      // 156
  // `when` used to be a number.                                                                                 // 157
  return new Date((new Date(when)).getTime() + getTokenLifetimeMs());                                            // 158
};                                                                                                               // 159
                                                                                                                 // 160
Accounts._tokenExpiresSoon = function (when) {                                                                   // 161
  var minLifetimeMs = .1 * getTokenLifetimeMs();                                                                 // 162
  var minLifetimeCapMs = MIN_TOKEN_LIFETIME_CAP_SECS * 1000;                                                     // 163
  if (minLifetimeMs > minLifetimeCapMs)                                                                          // 164
    minLifetimeMs = minLifetimeCapMs;                                                                            // 165
  return new Date() > (new Date(when) - minLifetimeMs);                                                          // 166
};                                                                                                               // 167
                                                                                                                 // 168
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/accounts-base/accounts_server.js                                                                     //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
var crypto = Npm.require('crypto');                                                                              // 1
                                                                                                                 // 2
///                                                                                                              // 3
/// CURRENT USER                                                                                                 // 4
///                                                                                                              // 5
                                                                                                                 // 6
Meteor.userId = function () {                                                                                    // 7
  // This function only works if called inside a method. In theory, it                                           // 8
  // could also be called from publish statements, since they also                                               // 9
  // have a userId associated with them. However, given that publish                                             // 10
  // functions aren't reactive, using any of the infomation from                                                 // 11
  // Meteor.user() in a publish function will always use the value                                               // 12
  // from when the function first runs. This is likely not what the                                              // 13
  // user expects. The way to make this work in a publish is to do                                               // 14
  // Meteor.find(this.userId()).observe and recompute when the user                                              // 15
  // record changes.                                                                                             // 16
  var currentInvocation = DDP._CurrentInvocation.get();                                                          // 17
  if (!currentInvocation)                                                                                        // 18
    throw new Error("Meteor.userId can only be invoked in method calls. Use this.userId in publish functions."); // 19
  return currentInvocation.userId;                                                                               // 20
};                                                                                                               // 21
                                                                                                                 // 22
Meteor.user = function () {                                                                                      // 23
  var userId = Meteor.userId();                                                                                  // 24
  if (!userId)                                                                                                   // 25
    return null;                                                                                                 // 26
  return Meteor.users.findOne(userId);                                                                           // 27
};                                                                                                               // 28
                                                                                                                 // 29
                                                                                                                 // 30
///                                                                                                              // 31
/// LOGIN HOOKS                                                                                                  // 32
///                                                                                                              // 33
                                                                                                                 // 34
// Exceptions inside the hook callback are passed up to us.                                                      // 35
var validateLoginHook = new Hook();                                                                              // 36
                                                                                                                 // 37
// Callback exceptions are printed with Meteor._debug and ignored.                                               // 38
var onLoginHook = new Hook({                                                                                     // 39
  debugPrintExceptions: "onLogin callback"                                                                       // 40
});                                                                                                              // 41
var onLoginFailureHook = new Hook({                                                                              // 42
  debugPrintExceptions: "onLoginFailure callback"                                                                // 43
});                                                                                                              // 44
                                                                                                                 // 45
Accounts.validateLoginAttempt = function (func) {                                                                // 46
  return validateLoginHook.register(func);                                                                       // 47
};                                                                                                               // 48
                                                                                                                 // 49
Accounts.onLogin = function (func) {                                                                             // 50
  return onLoginHook.register(func);                                                                             // 51
};                                                                                                               // 52
                                                                                                                 // 53
Accounts.onLoginFailure = function (func) {                                                                      // 54
  return onLoginFailureHook.register(func);                                                                      // 55
};                                                                                                               // 56
                                                                                                                 // 57
                                                                                                                 // 58
// Give each login hook callback a fresh cloned copy of the attempt                                              // 59
// object, but don't clone the connection.                                                                       // 60
//                                                                                                               // 61
var cloneAttemptWithConnection = function (connection, attempt) {                                                // 62
  var clonedAttempt = EJSON.clone(attempt);                                                                      // 63
  clonedAttempt.connection = connection;                                                                         // 64
  return clonedAttempt;                                                                                          // 65
};                                                                                                               // 66
                                                                                                                 // 67
var validateLogin = function (connection, attempt) {                                                             // 68
  validateLoginHook.each(function (callback) {                                                                   // 69
    var ret;                                                                                                     // 70
    try {                                                                                                        // 71
      ret = callback(cloneAttemptWithConnection(connection, attempt));                                           // 72
    }                                                                                                            // 73
    catch (e) {                                                                                                  // 74
      attempt.allowed = false;                                                                                   // 75
      // XXX this means the last thrown error overrides previous error                                           // 76
      // messages. Maybe this is surprising to users and we should make                                          // 77
      // overriding errors more explicit. (see                                                                   // 78
      // https://github.com/meteor/meteor/issues/1960)                                                           // 79
      attempt.error = e;                                                                                         // 80
      return true;                                                                                               // 81
    }                                                                                                            // 82
    if (! ret) {                                                                                                 // 83
      attempt.allowed = false;                                                                                   // 84
      // don't override a specific error provided by a previous                                                  // 85
      // validator or the initial attempt (eg "incorrect password").                                             // 86
      if (!attempt.error)                                                                                        // 87
        attempt.error = new Meteor.Error(403, "Login forbidden");                                                // 88
    }                                                                                                            // 89
    return true;                                                                                                 // 90
  });                                                                                                            // 91
};                                                                                                               // 92
                                                                                                                 // 93
                                                                                                                 // 94
var successfulLogin = function (connection, attempt) {                                                           // 95
  onLoginHook.each(function (callback) {                                                                         // 96
    callback(cloneAttemptWithConnection(connection, attempt));                                                   // 97
    return true;                                                                                                 // 98
  });                                                                                                            // 99
};                                                                                                               // 100
                                                                                                                 // 101
var failedLogin = function (connection, attempt) {                                                               // 102
  onLoginFailureHook.each(function (callback) {                                                                  // 103
    callback(cloneAttemptWithConnection(connection, attempt));                                                   // 104
    return true;                                                                                                 // 105
  });                                                                                                            // 106
};                                                                                                               // 107
                                                                                                                 // 108
                                                                                                                 // 109
///                                                                                                              // 110
/// LOGIN METHODS                                                                                                // 111
///                                                                                                              // 112
                                                                                                                 // 113
// Login methods return to the client an object containing these                                                 // 114
// fields when the user was logged in successfully:                                                              // 115
//                                                                                                               // 116
//   id: userId                                                                                                  // 117
//   token: *                                                                                                    // 118
//   tokenExpires: *                                                                                             // 119
//                                                                                                               // 120
// tokenExpires is optional and intends to provide a hint to the                                                 // 121
// client as to when the token will expire. If not provided, the                                                 // 122
// client will call Accounts._tokenExpiration, passing it the date                                               // 123
// that it received the token.                                                                                   // 124
//                                                                                                               // 125
// The login method will throw an error back to the client if the user                                           // 126
// failed to log in.                                                                                             // 127
//                                                                                                               // 128
//                                                                                                               // 129
// Login handlers and service specific login methods such as                                                     // 130
// `createUser` internally return a `result` object containing these                                             // 131
// fields:                                                                                                       // 132
//                                                                                                               // 133
//   type:                                                                                                       // 134
//     optional string; the service name, overrides the handler                                                  // 135
//     default if present.                                                                                       // 136
//                                                                                                               // 137
//   error:                                                                                                      // 138
//     exception; if the user is not allowed to login, the reason why.                                           // 139
//                                                                                                               // 140
//   userId:                                                                                                     // 141
//     string; the user id of the user attempting to login (if                                                   // 142
//     known), required for an allowed login.                                                                    // 143
//                                                                                                               // 144
//   options:                                                                                                    // 145
//     optional object merged into the result returned by the login                                              // 146
//     method; used by HAMK from SRP.                                                                            // 147
//                                                                                                               // 148
//   stampedLoginToken:                                                                                          // 149
//     optional object with `token` and `when` indicating the login                                              // 150
//     token is already present in the database, returned by the                                                 // 151
//     "resume" login handler.                                                                                   // 152
//                                                                                                               // 153
// For convenience, login methods can also throw an exception, which                                             // 154
// is converted into an {error} result.  However, if the id of the                                               // 155
// user attempting the login is known, a {userId, error} result should                                           // 156
// be returned instead since the user id is not captured when an                                                 // 157
// exception is thrown.                                                                                          // 158
//                                                                                                               // 159
// This internal `result` object is automatically converted into the                                             // 160
// public {id, token, tokenExpires} object returned to the client.                                               // 161
                                                                                                                 // 162
                                                                                                                 // 163
// Try a login method, converting thrown exceptions into an {error}                                              // 164
// result.  The `type` argument is a default, inserted into the result                                           // 165
// object if not explicitly returned.                                                                            // 166
//                                                                                                               // 167
var tryLoginMethod = function (type, fn) {                                                                       // 168
  var result;                                                                                                    // 169
  try {                                                                                                          // 170
    result = fn();                                                                                               // 171
  }                                                                                                              // 172
  catch (e) {                                                                                                    // 173
    result = {error: e};                                                                                         // 174
  }                                                                                                              // 175
                                                                                                                 // 176
  if (result && !result.type && type)                                                                            // 177
    result.type = type;                                                                                          // 178
                                                                                                                 // 179
  return result;                                                                                                 // 180
};                                                                                                               // 181
                                                                                                                 // 182
                                                                                                                 // 183
// Log in a user on a connection.                                                                                // 184
//                                                                                                               // 185
// We use the method invocation to set the user id on the connection,                                            // 186
// not the connection object directly. setUserId is tied to methods to                                           // 187
// enforce clear ordering of method application (using wait methods on                                           // 188
// the client, and a no setUserId after unblock restriction on the                                               // 189
// server)                                                                                                       // 190
//                                                                                                               // 191
// The `stampedLoginToken` parameter is optional.  When present, it                                              // 192
// indicates that the login token has already been inserted into the                                             // 193
// database and doesn't need to be inserted again.  (It's used by the                                            // 194
// "resume" login handler).                                                                                      // 195
var loginUser = function (methodInvocation, userId, stampedLoginToken) {                                         // 196
  if (! stampedLoginToken) {                                                                                     // 197
    stampedLoginToken = Accounts._generateStampedLoginToken();                                                   // 198
    Accounts._insertLoginToken(userId, stampedLoginToken);                                                       // 199
  }                                                                                                              // 200
                                                                                                                 // 201
  // This order (and the avoidance of yields) is important to make                                               // 202
  // sure that when publish functions are rerun, they see a                                                      // 203
  // consistent view of the world: the userId is set and matches                                                 // 204
  // the login token on the connection (not that there is                                                        // 205
  // currently a public API for reading the login token on a                                                     // 206
  // connection).                                                                                                // 207
  Meteor._noYieldsAllowed(function () {                                                                          // 208
    Accounts._setLoginToken(                                                                                     // 209
      userId,                                                                                                    // 210
      methodInvocation.connection,                                                                               // 211
      Accounts._hashLoginToken(stampedLoginToken.token)                                                          // 212
    );                                                                                                           // 213
  });                                                                                                            // 214
                                                                                                                 // 215
  methodInvocation.setUserId(userId);                                                                            // 216
                                                                                                                 // 217
  return {                                                                                                       // 218
    id: userId,                                                                                                  // 219
    token: stampedLoginToken.token,                                                                              // 220
    tokenExpires: Accounts._tokenExpiration(stampedLoginToken.when)                                              // 221
  };                                                                                                             // 222
};                                                                                                               // 223
                                                                                                                 // 224
                                                                                                                 // 225
// After a login method has completed, call the login hooks.  Note                                               // 226
// that `attemptLogin` is called for *all* login attempts, even ones                                             // 227
// which aren't successful (such as an invalid password, etc).                                                   // 228
//                                                                                                               // 229
// If the login is allowed and isn't aborted by a validate login hook                                            // 230
// callback, log in the user.                                                                                    // 231
//                                                                                                               // 232
var attemptLogin = function (methodInvocation, methodName, methodArgs, result) {                                 // 233
  if (!result)                                                                                                   // 234
    throw new Error("result is required");                                                                       // 235
                                                                                                                 // 236
  // XXX A programming error in a login handler can lead to this occuring, and                                   // 237
  // then we don't call onLogin or onLoginFailure callbacks. Should                                              // 238
  // tryLoginMethod catch this case and turn it into an error?                                                   // 239
  if (!result.userId && !result.error)                                                                           // 240
    throw new Error("A login method must specify a userId or an error");                                         // 241
                                                                                                                 // 242
  var user;                                                                                                      // 243
  if (result.userId)                                                                                             // 244
    user = Meteor.users.findOne(result.userId);                                                                  // 245
                                                                                                                 // 246
  var attempt = {                                                                                                // 247
    type: result.type || "unknown",                                                                              // 248
    allowed: !! (result.userId && !result.error),                                                                // 249
    methodName: methodName,                                                                                      // 250
    methodArguments: _.toArray(methodArgs)                                                                       // 251
  };                                                                                                             // 252
  if (result.error)                                                                                              // 253
    attempt.error = result.error;                                                                                // 254
  if (user)                                                                                                      // 255
    attempt.user = user;                                                                                         // 256
                                                                                                                 // 257
  // validateLogin may mutate `attempt` by adding an error and changing allowed                                  // 258
  // to false, but that's the only change it can make (and the user's callbacks                                  // 259
  // only get a clone of `attempt`).                                                                             // 260
  validateLogin(methodInvocation.connection, attempt);                                                           // 261
                                                                                                                 // 262
  if (attempt.allowed) {                                                                                         // 263
    var ret = _.extend(                                                                                          // 264
      loginUser(methodInvocation, result.userId, result.stampedLoginToken),                                      // 265
      result.options || {}                                                                                       // 266
    );                                                                                                           // 267
    successfulLogin(methodInvocation.connection, attempt);                                                       // 268
    return ret;                                                                                                  // 269
  }                                                                                                              // 270
  else {                                                                                                         // 271
    failedLogin(methodInvocation.connection, attempt);                                                           // 272
    throw attempt.error;                                                                                         // 273
  }                                                                                                              // 274
};                                                                                                               // 275
                                                                                                                 // 276
                                                                                                                 // 277
// All service specific login methods should go through this function.                                           // 278
// Ensure that thrown exceptions are caught and that login hook                                                  // 279
// callbacks are still called.                                                                                   // 280
//                                                                                                               // 281
Accounts._loginMethod = function (methodInvocation, methodName, methodArgs, type, fn) {                          // 282
  return attemptLogin(                                                                                           // 283
    methodInvocation,                                                                                            // 284
    methodName,                                                                                                  // 285
    methodArgs,                                                                                                  // 286
    tryLoginMethod(type, fn)                                                                                     // 287
  );                                                                                                             // 288
};                                                                                                               // 289
                                                                                                                 // 290
                                                                                                                 // 291
// Report a login attempt failed outside the context of a normal login                                           // 292
// method. This is for use in the case where there is a multi-step login                                         // 293
// procedure (eg SRP based password login). If a method early in the                                             // 294
// chain fails, it should call this function to report a failure. There                                          // 295
// is no corresponding method for a successful login; methods that can                                           // 296
// succeed at logging a user in should always be actual login methods                                            // 297
// (using either Accounts._loginMethod or Accounts.registerLoginHandler).                                        // 298
Accounts._reportLoginFailure = function (methodInvocation, methodName, methodArgs, result) {                     // 299
  var attempt = {                                                                                                // 300
    type: result.type || "unknown",                                                                              // 301
    allowed: false,                                                                                              // 302
    error: result.error,                                                                                         // 303
    methodName: methodName,                                                                                      // 304
    methodArguments: _.toArray(methodArgs)                                                                       // 305
  };                                                                                                             // 306
  if (result.userId)                                                                                             // 307
    attempt.user = Meteor.users.findOne(result.userId);                                                          // 308
                                                                                                                 // 309
  validateLogin(methodInvocation.connection, attempt);                                                           // 310
  failedLogin(methodInvocation.connection, attempt);                                                             // 311
  // validateLogin may mutate attempt to set a new error message. Return                                         // 312
  // the modified version.                                                                                       // 313
  return attempt;                                                                                                // 314
};                                                                                                               // 315
                                                                                                                 // 316
                                                                                                                 // 317
///                                                                                                              // 318
/// LOGIN HANDLERS                                                                                               // 319
///                                                                                                              // 320
                                                                                                                 // 321
// list of all registered handlers.                                                                              // 322
var loginHandlers = [];                                                                                          // 323
                                                                                                                 // 324
// The main entry point for auth packages to hook in to login.                                                   // 325
//                                                                                                               // 326
// A login handler is a login method which can return `undefined` to                                             // 327
// indicate that the login request is not handled by this handler.                                               // 328
//                                                                                                               // 329
// @param name {String} Optional.  The service name, used by default                                             // 330
// if a specific service name isn't returned in the result.                                                      // 331
//                                                                                                               // 332
// @param handler {Function} A function that receives an options object                                          // 333
// (as passed as an argument to the `login` method) and returns one of:                                          // 334
// - `undefined`, meaning don't handle;                                                                          // 335
// - a login method result object                                                                                // 336
                                                                                                                 // 337
Accounts.registerLoginHandler = function(name, handler) {                                                        // 338
  if (! handler) {                                                                                               // 339
    handler = name;                                                                                              // 340
    name = null;                                                                                                 // 341
  }                                                                                                              // 342
  loginHandlers.push({name: name, handler: handler});                                                            // 343
};                                                                                                               // 344
                                                                                                                 // 345
                                                                                                                 // 346
// Checks a user's credentials against all the registered login                                                  // 347
// handlers, and returns a login token if the credentials are valid. It                                          // 348
// is like the login method, except that it doesn't set the logged-in                                            // 349
// user on the connection. Throws a Meteor.Error if logging in fails,                                            // 350
// including the case where none of the login handlers handled the login                                         // 351
// request. Otherwise, returns {id: userId, token: *, tokenExpires: *}.                                          // 352
//                                                                                                               // 353
// For example, if you want to login with a plaintext password, `options` could be                               // 354
//   { user: { username: <username> }, password: <password> }, or                                                // 355
//   { user: { email: <email> }, password: <password> }.                                                         // 356
                                                                                                                 // 357
// Try all of the registered login handlers until one of them doesn't                                            // 358
// return `undefined`, meaning it handled this call to `login`. Return                                           // 359
// that return value.                                                                                            // 360
var runLoginHandlers = function (methodInvocation, options) {                                                    // 361
  for (var i = 0; i < loginHandlers.length; ++i) {                                                               // 362
    var handler = loginHandlers[i];                                                                              // 363
                                                                                                                 // 364
    var result = tryLoginMethod(                                                                                 // 365
      handler.name,                                                                                              // 366
      function () {                                                                                              // 367
        return handler.handler.call(methodInvocation, options);                                                  // 368
      }                                                                                                          // 369
    );                                                                                                           // 370
                                                                                                                 // 371
    if (result)                                                                                                  // 372
      return result;                                                                                             // 373
    else if (result !== undefined)                                                                               // 374
      throw new Meteor.Error(400, "A login handler should return a result or undefined");                        // 375
  }                                                                                                              // 376
                                                                                                                 // 377
  return {                                                                                                       // 378
    type: null,                                                                                                  // 379
    error: new Meteor.Error(400, "Unrecognized options for login request")                                       // 380
  };                                                                                                             // 381
};                                                                                                               // 382
                                                                                                                 // 383
// Deletes the given loginToken from the database.                                                               // 384
//                                                                                                               // 385
// For new-style hashed token, this will cause all connections                                                   // 386
// associated with the token to be closed.                                                                       // 387
//                                                                                                               // 388
// Any connections associated with old-style unhashed tokens will be                                             // 389
// in the process of becoming associated with hashed tokens and then                                             // 390
// they'll get closed.                                                                                           // 391
Accounts.destroyToken = function (userId, loginToken) {                                                          // 392
  Meteor.users.update(userId, {                                                                                  // 393
    $pull: {                                                                                                     // 394
      "services.resume.loginTokens": {                                                                           // 395
        $or: [                                                                                                   // 396
          { hashedToken: loginToken },                                                                           // 397
          { token: loginToken }                                                                                  // 398
        ]                                                                                                        // 399
      }                                                                                                          // 400
    }                                                                                                            // 401
  });                                                                                                            // 402
};                                                                                                               // 403
                                                                                                                 // 404
// Actual methods for login and logout. This is the entry point for                                              // 405
// clients to actually log in.                                                                                   // 406
Meteor.methods({                                                                                                 // 407
  // @returns {Object|null}                                                                                      // 408
  //   If successful, returns {token: reconnectToken, id: userId}                                                // 409
  //   If unsuccessful (for example, if the user closed the oauth login popup),                                  // 410
  //     throws an error describing the reason                                                                   // 411
  login: function(options) {                                                                                     // 412
    var self = this;                                                                                             // 413
                                                                                                                 // 414
    // Login handlers should really also check whatever field they look at in                                    // 415
    // options, but we don't enforce it.                                                                         // 416
    check(options, Object);                                                                                      // 417
                                                                                                                 // 418
    var result = runLoginHandlers(self, options);                                                                // 419
                                                                                                                 // 420
    return attemptLogin(self, "login", arguments, result);                                                       // 421
  },                                                                                                             // 422
                                                                                                                 // 423
  logout: function() {                                                                                           // 424
    var token = Accounts._getLoginToken(this.connection.id);                                                     // 425
    Accounts._setLoginToken(this.userId, this.connection, null);                                                 // 426
    if (token && this.userId)                                                                                    // 427
      Accounts.destroyToken(this.userId, token);                                                                 // 428
    this.setUserId(null);                                                                                        // 429
  },                                                                                                             // 430
                                                                                                                 // 431
  // Delete all the current user's tokens and close all open connections logged                                  // 432
  // in as this user. Returns a fresh new login token that this client can                                       // 433
  // use. Tests set Accounts._noConnectionCloseDelayForTest to delete tokens                                     // 434
  // immediately instead of using a delay.                                                                       // 435
  //                                                                                                             // 436
  // XXX COMPAT WITH 0.7.2                                                                                       // 437
  // This single `logoutOtherClients` method has been replaced with two                                          // 438
  // methods, one that you call to get a new token, and another that you                                         // 439
  // call to remove all tokens except your own. The new design allows                                            // 440
  // clients to know when other clients have actually been logged                                                // 441
  // out. (The `logoutOtherClients` method guarantees the caller that                                            // 442
  // the other clients will be logged out at some point, but makes no                                            // 443
  // guarantees about when.) This method is left in for backwards                                                // 444
  // compatibility, especially since application code might be calling                                           // 445
  // this method directly.                                                                                       // 446
  //                                                                                                             // 447
  // @returns {Object} Object with token and tokenExpires keys.                                                  // 448
  logoutOtherClients: function () {                                                                              // 449
    var self = this;                                                                                             // 450
    var user = Meteor.users.findOne(self.userId, {                                                               // 451
      fields: {                                                                                                  // 452
        "services.resume.loginTokens": true                                                                      // 453
      }                                                                                                          // 454
    });                                                                                                          // 455
    if (user) {                                                                                                  // 456
      // Save the current tokens in the database to be deleted in                                                // 457
      // CONNECTION_CLOSE_DELAY_MS ms. This gives other connections in the                                       // 458
      // caller's browser time to find the fresh token in localStorage. We save                                  // 459
      // the tokens in the database in case we crash before actually deleting                                    // 460
      // them.                                                                                                   // 461
      var tokens = user.services.resume.loginTokens;                                                             // 462
      var newToken = Accounts._generateStampedLoginToken();                                                      // 463
      var userId = self.userId;                                                                                  // 464
      Meteor.users.update(userId, {                                                                              // 465
        $set: {                                                                                                  // 466
          "services.resume.loginTokensToDelete": tokens,                                                         // 467
          "services.resume.haveLoginTokensToDelete": true                                                        // 468
        },                                                                                                       // 469
        $push: { "services.resume.loginTokens": Accounts._hashStampedToken(newToken) }                           // 470
      });                                                                                                        // 471
      Meteor.setTimeout(function () {                                                                            // 472
        // The observe on Meteor.users will take care of closing the connections                                 // 473
        // associated with `tokens`.                                                                             // 474
        deleteSavedTokens(userId, tokens);                                                                       // 475
      }, Accounts._noConnectionCloseDelayForTest ? 0 :                                                           // 476
                        CONNECTION_CLOSE_DELAY_MS);                                                              // 477
      // We do not set the login token on this connection, but instead the                                       // 478
      // observe closes the connection and the client will reconnect with the                                    // 479
      // new token.                                                                                              // 480
      return {                                                                                                   // 481
        token: newToken.token,                                                                                   // 482
        tokenExpires: Accounts._tokenExpiration(newToken.when)                                                   // 483
      };                                                                                                         // 484
    } else {                                                                                                     // 485
      throw new Meteor.Error("You are not logged in.");                                                          // 486
    }                                                                                                            // 487
  },                                                                                                             // 488
                                                                                                                 // 489
  // Generates a new login token with the same expiration as the                                                 // 490
  // connection's current token and saves it to the database. Associates                                         // 491
  // the connection with this new token and returns it. Throws an error                                          // 492
  // if called on a connection that isn't logged in.                                                             // 493
  //                                                                                                             // 494
  // @returns Object                                                                                             // 495
  //   If successful, returns { token: <new token>, id: <user id>,                                               // 496
  //   tokenExpires: <expiration date> }.                                                                        // 497
  getNewToken: function () {                                                                                     // 498
    var self = this;                                                                                             // 499
    var user = Meteor.users.findOne(self.userId, {                                                               // 500
      fields: { "services.resume.loginTokens": 1 }                                                               // 501
    });                                                                                                          // 502
    if (! self.userId || ! user) {                                                                               // 503
      throw new Meteor.Error("You are not logged in.");                                                          // 504
    }                                                                                                            // 505
    // Be careful not to generate a new token that has a later                                                   // 506
    // expiration than the curren token. Otherwise, a bad guy with a                                             // 507
    // stolen token could use this method to stop his stolen token from                                          // 508
    // ever expiring.                                                                                            // 509
    var currentHashedToken = Accounts._getLoginToken(self.connection.id);                                        // 510
    var currentStampedToken = _.find(                                                                            // 511
      user.services.resume.loginTokens,                                                                          // 512
      function (stampedToken) {                                                                                  // 513
        return stampedToken.hashedToken === currentHashedToken;                                                  // 514
      }                                                                                                          // 515
    );                                                                                                           // 516
    if (! currentStampedToken) { // safety belt: this should never happen                                        // 517
      throw new Meteor.Error("Invalid login token");                                                             // 518
    }                                                                                                            // 519
    var newStampedToken = Accounts._generateStampedLoginToken();                                                 // 520
    newStampedToken.when = currentStampedToken.when;                                                             // 521
    Accounts._insertLoginToken(self.userId, newStampedToken);                                                    // 522
    return loginUser(self, self.userId, newStampedToken);                                                        // 523
  },                                                                                                             // 524
                                                                                                                 // 525
  // Removes all tokens except the token associated with the current                                             // 526
  // connection. Throws an error if the connection is not logged                                                 // 527
  // in. Returns nothing on success.                                                                             // 528
  removeOtherTokens: function () {                                                                               // 529
    var self = this;                                                                                             // 530
    if (! self.userId) {                                                                                         // 531
      throw new Meteor.Error("You are not logged in.");                                                          // 532
    }                                                                                                            // 533
    var currentToken = Accounts._getLoginToken(self.connection.id);                                              // 534
    Meteor.users.update(self.userId, {                                                                           // 535
      $pull: {                                                                                                   // 536
        "services.resume.loginTokens": { hashedToken: { $ne: currentToken } }                                    // 537
      }                                                                                                          // 538
    });                                                                                                          // 539
  }                                                                                                              // 540
});                                                                                                              // 541
                                                                                                                 // 542
///                                                                                                              // 543
/// ACCOUNT DATA                                                                                                 // 544
///                                                                                                              // 545
                                                                                                                 // 546
// connectionId -> {connection, loginToken, srpChallenge}                                                        // 547
var accountData = {};                                                                                            // 548
                                                                                                                 // 549
// HACK: This is used by 'meteor-accounts' to get the loginToken for a                                           // 550
// connection. Maybe there should be a public way to do that.                                                    // 551
Accounts._getAccountData = function (connectionId, field) {                                                      // 552
  var data = accountData[connectionId];                                                                          // 553
  return data && data[field];                                                                                    // 554
};                                                                                                               // 555
                                                                                                                 // 556
Accounts._setAccountData = function (connectionId, field, value) {                                               // 557
  var data = accountData[connectionId];                                                                          // 558
                                                                                                                 // 559
  // safety belt. shouldn't happen. accountData is set in onConnection,                                          // 560
  // we don't have a connectionId until it is set.                                                               // 561
  if (!data)                                                                                                     // 562
    return;                                                                                                      // 563
                                                                                                                 // 564
  if (value === undefined)                                                                                       // 565
    delete data[field];                                                                                          // 566
  else                                                                                                           // 567
    data[field] = value;                                                                                         // 568
};                                                                                                               // 569
                                                                                                                 // 570
Meteor.server.onConnection(function (connection) {                                                               // 571
  accountData[connection.id] = {connection: connection};                                                         // 572
  connection.onClose(function () {                                                                               // 573
    removeTokenFromConnection(connection.id);                                                                    // 574
    delete accountData[connection.id];                                                                           // 575
  });                                                                                                            // 576
});                                                                                                              // 577
                                                                                                                 // 578
                                                                                                                 // 579
///                                                                                                              // 580
/// RECONNECT TOKENS                                                                                             // 581
///                                                                                                              // 582
/// support reconnecting using a meteor login token                                                              // 583
                                                                                                                 // 584
Accounts._hashLoginToken = function (loginToken) {                                                               // 585
  var hash = crypto.createHash('sha256');                                                                        // 586
  hash.update(loginToken);                                                                                       // 587
  return hash.digest('base64');                                                                                  // 588
};                                                                                                               // 589
                                                                                                                 // 590
                                                                                                                 // 591
// {token, when} => {hashedToken, when}                                                                          // 592
Accounts._hashStampedToken = function (stampedToken) {                                                           // 593
  return _.extend(                                                                                               // 594
    _.omit(stampedToken, 'token'),                                                                               // 595
    {hashedToken: Accounts._hashLoginToken(stampedToken.token)}                                                  // 596
  );                                                                                                             // 597
};                                                                                                               // 598
                                                                                                                 // 599
                                                                                                                 // 600
// Using $addToSet avoids getting an index error if another client                                               // 601
// logging in simultaneously has already inserted the new hashed                                                 // 602
// token.                                                                                                        // 603
Accounts._insertHashedLoginToken = function (userId, hashedToken, query) {                                       // 604
  query = query ? _.clone(query) : {};                                                                           // 605
  query._id = userId;                                                                                            // 606
  Meteor.users.update(                                                                                           // 607
    query,                                                                                                       // 608
    { $addToSet: {                                                                                               // 609
        "services.resume.loginTokens": hashedToken                                                               // 610
    } }                                                                                                          // 611
  );                                                                                                             // 612
};                                                                                                               // 613
                                                                                                                 // 614
                                                                                                                 // 615
// Exported for tests.                                                                                           // 616
Accounts._insertLoginToken = function (userId, stampedToken, query) {                                            // 617
  Accounts._insertHashedLoginToken(                                                                              // 618
    userId,                                                                                                      // 619
    Accounts._hashStampedToken(stampedToken),                                                                    // 620
    query                                                                                                        // 621
  );                                                                                                             // 622
};                                                                                                               // 623
                                                                                                                 // 624
                                                                                                                 // 625
Accounts._clearAllLoginTokens = function (userId) {                                                              // 626
  Meteor.users.update(                                                                                           // 627
    userId,                                                                                                      // 628
    {$set: {'services.resume.loginTokens': []}}                                                                  // 629
  );                                                                                                             // 630
};                                                                                                               // 631
                                                                                                                 // 632
// connection id -> observe handle for the login token that this                                                 // 633
// connection is currently associated with, or null. Null indicates that                                         // 634
// we are in the process of setting up the observe.                                                              // 635
var userObservesForConnections = {};                                                                             // 636
                                                                                                                 // 637
// test hook                                                                                                     // 638
Accounts._getUserObserve = function (connectionId) {                                                             // 639
  return userObservesForConnections[connectionId];                                                               // 640
};                                                                                                               // 641
                                                                                                                 // 642
// Clean up this connection's association with the token: that is, stop                                          // 643
// the observe that we started when we associated the connection with                                            // 644
// this token.                                                                                                   // 645
var removeTokenFromConnection = function (connectionId) {                                                        // 646
  if (_.has(userObservesForConnections, connectionId)) {                                                         // 647
    var observe = userObservesForConnections[connectionId];                                                      // 648
    if (observe === null) {                                                                                      // 649
      // We're in the process of setting up an observe for this                                                  // 650
      // connection. We can't clean up that observe yet, but if we                                               // 651
      // delete the null placeholder for this connection, then the                                               // 652
      // observe will get cleaned up as soon as it has been set up.                                              // 653
      delete userObservesForConnections[connectionId];                                                           // 654
    } else {                                                                                                     // 655
      delete userObservesForConnections[connectionId];                                                           // 656
      observe.stop();                                                                                            // 657
    }                                                                                                            // 658
  }                                                                                                              // 659
};                                                                                                               // 660
                                                                                                                 // 661
Accounts._getLoginToken = function (connectionId) {                                                              // 662
  return Accounts._getAccountData(connectionId, 'loginToken');                                                   // 663
};                                                                                                               // 664
                                                                                                                 // 665
// newToken is a hashed token.                                                                                   // 666
Accounts._setLoginToken = function (userId, connection, newToken) {                                              // 667
  removeTokenFromConnection(connection.id);                                                                      // 668
  Accounts._setAccountData(connection.id, 'loginToken', newToken);                                               // 669
                                                                                                                 // 670
  if (newToken) {                                                                                                // 671
    // Set up an observe for this token. If the token goes away, we need                                         // 672
    // to close the connection.  We defer the observe because there's                                            // 673
    // no need for it to be on the critical path for login; we just need                                         // 674
    // to ensure that the connection will get closed at some point if                                            // 675
    // the token gets deleted.                                                                                   // 676
    //                                                                                                           // 677
    // Initially, we set the observe for this connection to null; this                                           // 678
    // signifies to other code (which might run while we yield) that we                                          // 679
    // are in the process of setting up an observe for this                                                      // 680
    // connection. Once the observe is ready to go, we replace null with                                         // 681
    // the real observe handle (unless the placeholder has been deleted,                                         // 682
    // signifying that the connection was closed already -- in this case                                         // 683
    // we just clean up the observe that we started).                                                            // 684
    userObservesForConnections[connection.id] = null;                                                            // 685
    Meteor.defer(function () {                                                                                   // 686
      var foundMatchingUser;                                                                                     // 687
      // Because we upgrade unhashed login tokens to hashed tokens at                                            // 688
      // login time, sessions will only be logged in with a hashed                                               // 689
      // token. Thus we only need to observe hashed tokens here.                                                 // 690
      var observe = Meteor.users.find({                                                                          // 691
        _id: userId,                                                                                             // 692
        'services.resume.loginTokens.hashedToken': newToken                                                      // 693
      }, { fields: { _id: 1 } }).observeChanges({                                                                // 694
        added: function () {                                                                                     // 695
          foundMatchingUser = true;                                                                              // 696
        },                                                                                                       // 697
        removed: function () {                                                                                   // 698
          connection.close();                                                                                    // 699
          // The onClose callback for the connection takes care of                                               // 700
          // cleaning up the observe handle and any other state we have                                          // 701
          // lying around.                                                                                       // 702
        }                                                                                                        // 703
      });                                                                                                        // 704
                                                                                                                 // 705
      // If the user ran another login or logout command we were waiting for                                     // 706
      // the defer or added to fire, then we let the later one win (start an                                     // 707
      // observe, etc) and just stop our observe now.                                                            // 708
      //                                                                                                         // 709
      // Similarly, if the connection was already closed, then the onClose                                       // 710
      // callback would have called removeTokenFromConnection and there won't be                                 // 711
      // an entry in userObservesForConnections. We can stop the observe.                                        // 712
      if (Accounts._getAccountData(connection.id, 'loginToken') !== newToken ||                                  // 713
          !_.has(userObservesForConnections, connection.id)) {                                                   // 714
        observe.stop();                                                                                          // 715
        return;                                                                                                  // 716
      }                                                                                                          // 717
                                                                                                                 // 718
      if (userObservesForConnections[connection.id] !== null) {                                                  // 719
        throw new Error("Non-null user observe for connection " +                                                // 720
                        connection.id + " while observe was being set up?");                                     // 721
      }                                                                                                          // 722
                                                                                                                 // 723
      userObservesForConnections[connection.id] = observe;                                                       // 724
                                                                                                                 // 725
      if (! foundMatchingUser) {                                                                                 // 726
        // We've set up an observe on the user associated with `newToken`,                                       // 727
        // so if the new token is removed from the database, we'll close                                         // 728
        // the connection. But the token might have already been deleted                                         // 729
        // before we set up the observe, which wouldn't have closed the                                          // 730
        // connection because the observe wasn't running yet.                                                    // 731
        connection.close();                                                                                      // 732
      }                                                                                                          // 733
    });                                                                                                          // 734
  }                                                                                                              // 735
};                                                                                                               // 736
                                                                                                                 // 737
// Login handler for resume tokens.                                                                              // 738
Accounts.registerLoginHandler("resume", function(options) {                                                      // 739
  if (!options.resume)                                                                                           // 740
    return undefined;                                                                                            // 741
                                                                                                                 // 742
  check(options.resume, String);                                                                                 // 743
                                                                                                                 // 744
  var hashedToken = Accounts._hashLoginToken(options.resume);                                                    // 745
                                                                                                                 // 746
  // First look for just the new-style hashed login token, to avoid                                              // 747
  // sending the unhashed token to the database in a query if we don't                                           // 748
  // need to.                                                                                                    // 749
  var user = Meteor.users.findOne(                                                                               // 750
    {"services.resume.loginTokens.hashedToken": hashedToken});                                                   // 751
                                                                                                                 // 752
  if (! user) {                                                                                                  // 753
    // If we didn't find the hashed login token, try also looking for                                            // 754
    // the old-style unhashed token.  But we need to look for either                                             // 755
    // the old-style token OR the new-style token, because another                                               // 756
    // client connection logging in simultaneously might have already                                            // 757
    // converted the token.                                                                                      // 758
    user = Meteor.users.findOne({                                                                                // 759
      $or: [                                                                                                     // 760
        {"services.resume.loginTokens.hashedToken": hashedToken},                                                // 761
        {"services.resume.loginTokens.token": options.resume}                                                    // 762
      ]                                                                                                          // 763
    });                                                                                                          // 764
  }                                                                                                              // 765
                                                                                                                 // 766
  if (! user)                                                                                                    // 767
    return {                                                                                                     // 768
      error: new Meteor.Error(403, "You've been logged out by the server. Please log in again.")                 // 769
    };                                                                                                           // 770
                                                                                                                 // 771
  // Find the token, which will either be an object with fields                                                  // 772
  // {hashedToken, when} for a hashed token or {token, when} for an                                              // 773
  // unhashed token.                                                                                             // 774
  var oldUnhashedStyleToken;                                                                                     // 775
  var token = _.find(user.services.resume.loginTokens, function (token) {                                        // 776
    return token.hashedToken === hashedToken;                                                                    // 777
  });                                                                                                            // 778
  if (token) {                                                                                                   // 779
    oldUnhashedStyleToken = false;                                                                               // 780
  } else {                                                                                                       // 781
    token = _.find(user.services.resume.loginTokens, function (token) {                                          // 782
      return token.token === options.resume;                                                                     // 783
    });                                                                                                          // 784
    oldUnhashedStyleToken = true;                                                                                // 785
  }                                                                                                              // 786
                                                                                                                 // 787
  var tokenExpires = Accounts._tokenExpiration(token.when);                                                      // 788
  if (new Date() >= tokenExpires)                                                                                // 789
    return {                                                                                                     // 790
      userId: user._id,                                                                                          // 791
      error: new Meteor.Error(403, "Your session has expired. Please log in again.")                             // 792
    };                                                                                                           // 793
                                                                                                                 // 794
  // Update to a hashed token when an unhashed token is encountered.                                             // 795
  if (oldUnhashedStyleToken) {                                                                                   // 796
    // Only add the new hashed token if the old unhashed token still                                             // 797
    // exists (this avoids resurrecting the token if it was deleted                                              // 798
    // after we read it).  Using $addToSet avoids getting an index                                               // 799
    // error if another client logging in simultaneously has already                                             // 800
    // inserted the new hashed token.                                                                            // 801
    Meteor.users.update(                                                                                         // 802
      {                                                                                                          // 803
        _id: user._id,                                                                                           // 804
        "services.resume.loginTokens.token": options.resume                                                      // 805
      },                                                                                                         // 806
      {$addToSet: {                                                                                              // 807
        "services.resume.loginTokens": {                                                                         // 808
          "hashedToken": hashedToken,                                                                            // 809
          "when": token.when                                                                                     // 810
        }                                                                                                        // 811
      }}                                                                                                         // 812
    );                                                                                                           // 813
                                                                                                                 // 814
    // Remove the old token *after* adding the new, since otherwise                                              // 815
    // another client trying to login between our removing the old and                                           // 816
    // adding the new wouldn't find a token to login with.                                                       // 817
    Meteor.users.update(user._id, {                                                                              // 818
      $pull: {                                                                                                   // 819
        "services.resume.loginTokens": { "token": options.resume }                                               // 820
      }                                                                                                          // 821
    });                                                                                                          // 822
  }                                                                                                              // 823
                                                                                                                 // 824
  return {                                                                                                       // 825
    userId: user._id,                                                                                            // 826
    stampedLoginToken: {                                                                                         // 827
      token: options.resume,                                                                                     // 828
      when: token.when                                                                                           // 829
    }                                                                                                            // 830
  };                                                                                                             // 831
});                                                                                                              // 832
                                                                                                                 // 833
// (Also used by Meteor Accounts server and tests).                                                              // 834
//                                                                                                               // 835
Accounts._generateStampedLoginToken = function () {                                                              // 836
  return {token: Random.secret(), when: (new Date)};                                                             // 837
};                                                                                                               // 838
                                                                                                                 // 839
///                                                                                                              // 840
/// TOKEN EXPIRATION                                                                                             // 841
///                                                                                                              // 842
                                                                                                                 // 843
var expireTokenInterval;                                                                                         // 844
                                                                                                                 // 845
// Deletes expired tokens from the database and closes all open connections                                      // 846
// associated with these tokens.                                                                                 // 847
//                                                                                                               // 848
// Exported for tests. Also, the arguments are only used by                                                      // 849
// tests. oldestValidDate is simulate expiring tokens without waiting                                            // 850
// for them to actually expire. userId is used by tests to only expire                                           // 851
// tokens for the test user.                                                                                     // 852
var expireTokens = Accounts._expireTokens = function (oldestValidDate, userId) {                                 // 853
  var tokenLifetimeMs = getTokenLifetimeMs();                                                                    // 854
                                                                                                                 // 855
  // when calling from a test with extra arguments, you must specify both!                                       // 856
  if ((oldestValidDate && !userId) || (!oldestValidDate && userId)) {                                            // 857
    throw new Error("Bad test. Must specify both oldestValidDate and userId.");                                  // 858
  }                                                                                                              // 859
                                                                                                                 // 860
  oldestValidDate = oldestValidDate ||                                                                           // 861
    (new Date(new Date() - tokenLifetimeMs));                                                                    // 862
  var userFilter = userId ? {_id: userId} : {};                                                                  // 863
                                                                                                                 // 864
                                                                                                                 // 865
  // Backwards compatible with older versions of meteor that stored login token                                  // 866
  // timestamps as numbers.                                                                                      // 867
  Meteor.users.update(_.extend(userFilter, {                                                                     // 868
    $or: [                                                                                                       // 869
      { "services.resume.loginTokens.when": { $lt: oldestValidDate } },                                          // 870
      { "services.resume.loginTokens.when": { $lt: +oldestValidDate } }                                          // 871
    ]                                                                                                            // 872
  }), {                                                                                                          // 873
    $pull: {                                                                                                     // 874
      "services.resume.loginTokens": {                                                                           // 875
        $or: [                                                                                                   // 876
          { when: { $lt: oldestValidDate } },                                                                    // 877
          { when: { $lt: +oldestValidDate } }                                                                    // 878
        ]                                                                                                        // 879
      }                                                                                                          // 880
    }                                                                                                            // 881
  }, { multi: true });                                                                                           // 882
  // The observe on Meteor.users will take care of closing connections for                                       // 883
  // expired tokens.                                                                                             // 884
};                                                                                                               // 885
                                                                                                                 // 886
maybeStopExpireTokensInterval = function () {                                                                    // 887
  if (_.has(Accounts._options, "loginExpirationInDays") &&                                                       // 888
      Accounts._options.loginExpirationInDays === null &&                                                        // 889
      expireTokenInterval) {                                                                                     // 890
    Meteor.clearInterval(expireTokenInterval);                                                                   // 891
    expireTokenInterval = null;                                                                                  // 892
  }                                                                                                              // 893
};                                                                                                               // 894
                                                                                                                 // 895
expireTokenInterval = Meteor.setInterval(expireTokens,                                                           // 896
                                         EXPIRE_TOKENS_INTERVAL_MS);                                             // 897
                                                                                                                 // 898
                                                                                                                 // 899
///                                                                                                              // 900
/// OAuth Encryption Support                                                                                     // 901
///                                                                                                              // 902
                                                                                                                 // 903
var OAuthEncryption = Package["oauth-encryption"] && Package["oauth-encryption"].OAuthEncryption;                // 904
                                                                                                                 // 905
                                                                                                                 // 906
var usingOAuthEncryption = function () {                                                                         // 907
  return OAuthEncryption && OAuthEncryption.keyIsLoaded();                                                       // 908
};                                                                                                               // 909
                                                                                                                 // 910
                                                                                                                 // 911
// OAuth service data is temporarily stored in the pending credentials                                           // 912
// collection during the oauth authentication process.  Sensitive data                                           // 913
// such as access tokens are encrypted without the user id because                                               // 914
// we don't know the user id yet.  We re-encrypt these fields with the                                           // 915
// user id included when storing the service data permanently in                                                 // 916
// the users collection.                                                                                         // 917
//                                                                                                               // 918
var pinEncryptedFieldsToUser = function (serviceData, userId) {                                                  // 919
  _.each(_.keys(serviceData), function (key) {                                                                   // 920
    var value = serviceData[key];                                                                                // 921
    if (OAuthEncryption && OAuthEncryption.isSealed(value))                                                      // 922
      value = OAuthEncryption.seal(OAuthEncryption.open(value), userId);                                         // 923
    serviceData[key] = value;                                                                                    // 924
  });                                                                                                            // 925
};                                                                                                               // 926
                                                                                                                 // 927
                                                                                                                 // 928
// Encrypt unencrypted login service secrets when oauth-encryption is                                            // 929
// added.                                                                                                        // 930
//                                                                                                               // 931
// XXX For the oauthSecretKey to be available here at startup, the                                               // 932
// developer must call Accounts.config({oauthSecretKey: ...}) at load                                            // 933
// time, instead of in a Meteor.startup block, because the startup                                               // 934
// block in the app code will run after this accounts-base startup                                               // 935
// block.  Perhaps we need a post-startup callback?                                                              // 936
                                                                                                                 // 937
Meteor.startup(function () {                                                                                     // 938
  if (!usingOAuthEncryption())                                                                                   // 939
    return;                                                                                                      // 940
                                                                                                                 // 941
  var ServiceConfiguration =                                                                                     // 942
    Package['service-configuration'].ServiceConfiguration;                                                       // 943
                                                                                                                 // 944
  ServiceConfiguration.configurations.find( {$and: [                                                             // 945
      { secret: {$exists: true} },                                                                               // 946
      { "secret.algorithm": {$exists: false} }                                                                   // 947
    ] } ).                                                                                                       // 948
    forEach(function (config) {                                                                                  // 949
      ServiceConfiguration.configurations.update(                                                                // 950
        config._id,                                                                                              // 951
        { $set: {                                                                                                // 952
          secret: OAuthEncryption.seal(config.secret)                                                            // 953
        } }                                                                                                      // 954
      );                                                                                                         // 955
    });                                                                                                          // 956
});                                                                                                              // 957
                                                                                                                 // 958
                                                                                                                 // 959
///                                                                                                              // 960
/// CREATE USER HOOKS                                                                                            // 961
///                                                                                                              // 962
                                                                                                                 // 963
var onCreateUserHook = null;                                                                                     // 964
Accounts.onCreateUser = function (func) {                                                                        // 965
  if (onCreateUserHook)                                                                                          // 966
    throw new Error("Can only call onCreateUser once");                                                          // 967
  else                                                                                                           // 968
    onCreateUserHook = func;                                                                                     // 969
};                                                                                                               // 970
                                                                                                                 // 971
// XXX see comment on Accounts.createUser in passwords_server about adding a                                     // 972
// second "server options" argument.                                                                             // 973
var defaultCreateUserHook = function (options, user) {                                                           // 974
  if (options.profile)                                                                                           // 975
    user.profile = options.profile;                                                                              // 976
  return user;                                                                                                   // 977
};                                                                                                               // 978
                                                                                                                 // 979
// Called by accounts-password                                                                                   // 980
Accounts.insertUserDoc = function (options, user) {                                                              // 981
  // - clone user document, to protect from modification                                                         // 982
  // - add createdAt timestamp                                                                                   // 983
  // - prepare an _id, so that you can modify other collections (eg                                              // 984
  // create a first task for every new user)                                                                     // 985
  //                                                                                                             // 986
  // XXX If the onCreateUser or validateNewUser hooks fail, we might                                             // 987
  // end up having modified some other collection                                                                // 988
  // inappropriately. The solution is probably to have onCreateUser                                              // 989
  // accept two callbacks - one that gets called before inserting                                                // 990
  // the user document (in which you can modify its contents), and                                               // 991
  // one that gets called after (in which you should change other                                                // 992
  // collections)                                                                                                // 993
  user = _.extend({createdAt: new Date(), _id: Random.id()}, user);                                              // 994
                                                                                                                 // 995
  if (user.services)                                                                                             // 996
    _.each(user.services, function (serviceData) {                                                               // 997
      pinEncryptedFieldsToUser(serviceData, user._id);                                                           // 998
    });                                                                                                          // 999
                                                                                                                 // 1000
  var fullUser;                                                                                                  // 1001
  if (onCreateUserHook) {                                                                                        // 1002
    fullUser = onCreateUserHook(options, user);                                                                  // 1003
                                                                                                                 // 1004
    // This is *not* part of the API. We need this because we can't isolate                                      // 1005
    // the global server environment between tests, meaning we can't test                                        // 1006
    // both having a create user hook set and not having one set.                                                // 1007
    if (fullUser === 'TEST DEFAULT HOOK')                                                                        // 1008
      fullUser = defaultCreateUserHook(options, user);                                                           // 1009
  } else {                                                                                                       // 1010
    fullUser = defaultCreateUserHook(options, user);                                                             // 1011
  }                                                                                                              // 1012
                                                                                                                 // 1013
  _.each(validateNewUserHooks, function (hook) {                                                                 // 1014
    if (!hook(fullUser))                                                                                         // 1015
      throw new Meteor.Error(403, "User validation failed");                                                     // 1016
  });                                                                                                            // 1017
                                                                                                                 // 1018
  var userId;                                                                                                    // 1019
  try {                                                                                                          // 1020
    userId = Meteor.users.insert(fullUser);                                                                      // 1021
  } catch (e) {                                                                                                  // 1022
    // XXX string parsing sucks, maybe                                                                           // 1023
    // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day                                        // 1024
    if (e.name !== 'MongoError') throw e;                                                                        // 1025
    var match = e.err.match(/^E11000 duplicate key error index: ([^ ]+)/);                                       // 1026
    if (!match) throw e;                                                                                         // 1027
    if (match[1].indexOf('$emails.address') !== -1)                                                              // 1028
      throw new Meteor.Error(403, "Email already exists.");                                                      // 1029
    if (match[1].indexOf('username') !== -1)                                                                     // 1030
      throw new Meteor.Error(403, "Username already exists.");                                                   // 1031
    // XXX better error reporting for services.facebook.id duplicate, etc                                        // 1032
    throw e;                                                                                                     // 1033
  }                                                                                                              // 1034
  return userId;                                                                                                 // 1035
};                                                                                                               // 1036
                                                                                                                 // 1037
var validateNewUserHooks = [];                                                                                   // 1038
Accounts.validateNewUser = function (func) {                                                                     // 1039
  validateNewUserHooks.push(func);                                                                               // 1040
};                                                                                                               // 1041
                                                                                                                 // 1042
// XXX Find a better place for this utility function                                                             // 1043
// Like Perl's quotemeta: quotes all regexp metacharacters. See                                                  // 1044
//   https://github.com/substack/quotemeta/blob/master/index.js                                                  // 1045
var quotemeta = function (str) {                                                                                 // 1046
    return String(str).replace(/(\W)/g, '\\$1');                                                                 // 1047
};                                                                                                               // 1048
                                                                                                                 // 1049
// Helper function: returns false if email does not match company domain from                                    // 1050
// the configuration.                                                                                            // 1051
var testEmailDomain = function (email) {                                                                         // 1052
  var domain = Accounts._options.restrictCreationByEmailDomain;                                                  // 1053
  return !domain ||                                                                                              // 1054
    (_.isFunction(domain) && domain(email)) ||                                                                   // 1055
    (_.isString(domain) &&                                                                                       // 1056
      (new RegExp('@' + quotemeta(domain) + '$', 'i')).test(email));                                             // 1057
};                                                                                                               // 1058
                                                                                                                 // 1059
// Validate new user's email or Google/Facebook/GitHub account's email                                           // 1060
Accounts.validateNewUser(function (user) {                                                                       // 1061
  var domain = Accounts._options.restrictCreationByEmailDomain;                                                  // 1062
  if (!domain)                                                                                                   // 1063
    return true;                                                                                                 // 1064
                                                                                                                 // 1065
  var emailIsGood = false;                                                                                       // 1066
  if (!_.isEmpty(user.emails)) {                                                                                 // 1067
    emailIsGood = _.any(user.emails, function (email) {                                                          // 1068
      return testEmailDomain(email.address);                                                                     // 1069
    });                                                                                                          // 1070
  } else if (!_.isEmpty(user.services)) {                                                                        // 1071
    // Find any email of any service and check it                                                                // 1072
    emailIsGood = _.any(user.services, function (service) {                                                      // 1073
      return service.email && testEmailDomain(service.email);                                                    // 1074
    });                                                                                                          // 1075
  }                                                                                                              // 1076
                                                                                                                 // 1077
  if (emailIsGood)                                                                                               // 1078
    return true;                                                                                                 // 1079
                                                                                                                 // 1080
  if (_.isString(domain))                                                                                        // 1081
    throw new Meteor.Error(403, "@" + domain + " email required");                                               // 1082
  else                                                                                                           // 1083
    throw new Meteor.Error(403, "Email doesn't match the criteria.");                                            // 1084
});                                                                                                              // 1085
                                                                                                                 // 1086
///                                                                                                              // 1087
/// MANAGING USER OBJECTS                                                                                        // 1088
///                                                                                                              // 1089
                                                                                                                 // 1090
// Updates or creates a user after we authenticate with a 3rd party.                                             // 1091
//                                                                                                               // 1092
// @param serviceName {String} Service name (eg, twitter).                                                       // 1093
// @param serviceData {Object} Data to store in the user's record                                                // 1094
//        under services[serviceName]. Must include an "id" field                                                // 1095
//        which is a unique identifier for the user in the service.                                              // 1096
// @param options {Object, optional} Other options to pass to insertUserDoc                                      // 1097
//        (eg, profile)                                                                                          // 1098
// @returns {Object} Object with token and id keys, like the result                                              // 1099
//        of the "login" method.                                                                                 // 1100
//                                                                                                               // 1101
Accounts.updateOrCreateUserFromExternalService = function(                                                       // 1102
  serviceName, serviceData, options) {                                                                           // 1103
  options = _.clone(options || {});                                                                              // 1104
                                                                                                                 // 1105
  if (serviceName === "password" || serviceName === "resume")                                                    // 1106
    throw new Error(                                                                                             // 1107
      "Can't use updateOrCreateUserFromExternalService with internal service "                                   // 1108
        + serviceName);                                                                                          // 1109
  if (!_.has(serviceData, 'id'))                                                                                 // 1110
    throw new Error(                                                                                             // 1111
      "Service data for service " + serviceName + " must include id");                                           // 1112
                                                                                                                 // 1113
  // Look for a user with the appropriate service user id.                                                       // 1114
  var selector = {};                                                                                             // 1115
  var serviceIdKey = "services." + serviceName + ".id";                                                          // 1116
                                                                                                                 // 1117
  // XXX Temporary special case for Twitter. (Issue #629)                                                        // 1118
  //   The serviceData.id will be a string representation of an integer.                                         // 1119
  //   We want it to match either a stored string or int representation.                                         // 1120
  //   This is to cater to earlier versions of Meteor storing twitter                                            // 1121
  //   user IDs in number form, and recent versions storing them as strings.                                     // 1122
  //   This can be removed once migration technology is in place, and twitter                                    // 1123
  //   users stored with integer IDs have been migrated to string IDs.                                           // 1124
  if (serviceName === "twitter" && !isNaN(serviceData.id)) {                                                     // 1125
    selector["$or"] = [{},{}];                                                                                   // 1126
    selector["$or"][0][serviceIdKey] = serviceData.id;                                                           // 1127
    selector["$or"][1][serviceIdKey] = parseInt(serviceData.id, 10);                                             // 1128
  } else {                                                                                                       // 1129
    selector[serviceIdKey] = serviceData.id;                                                                     // 1130
  }                                                                                                              // 1131
                                                                                                                 // 1132
  var user = Meteor.users.findOne(selector);                                                                     // 1133
                                                                                                                 // 1134
  if (user) {                                                                                                    // 1135
    pinEncryptedFieldsToUser(serviceData, user._id);                                                             // 1136
                                                                                                                 // 1137
    // We *don't* process options (eg, profile) for update, but we do replace                                    // 1138
    // the serviceData (eg, so that we keep an unexpired access token and                                        // 1139
    // don't cache old email addresses in serviceData.email).                                                    // 1140
    // XXX provide an onUpdateUser hook which would let apps update                                              // 1141
    //     the profile too                                                                                       // 1142
    var setAttrs = {};                                                                                           // 1143
    _.each(serviceData, function(value, key) {                                                                   // 1144
      setAttrs["services." + serviceName + "." + key] = value;                                                   // 1145
    });                                                                                                          // 1146
                                                                                                                 // 1147
    // XXX Maybe we should re-use the selector above and notice if the update                                    // 1148
    //     touches nothing?                                                                                      // 1149
    Meteor.users.update(user._id, {$set: setAttrs});                                                             // 1150
    return {                                                                                                     // 1151
      type: serviceName,                                                                                         // 1152
      userId: user._id                                                                                           // 1153
    };                                                                                                           // 1154
  } else {                                                                                                       // 1155
    // Create a new user with the service data. Pass other options through to                                    // 1156
    // insertUserDoc.                                                                                            // 1157
    user = {services: {}};                                                                                       // 1158
    user.services[serviceName] = serviceData;                                                                    // 1159
    return {                                                                                                     // 1160
      type: serviceName,                                                                                         // 1161
      userId: Accounts.insertUserDoc(options, user)                                                              // 1162
    };                                                                                                           // 1163
  }                                                                                                              // 1164
};                                                                                                               // 1165
                                                                                                                 // 1166
                                                                                                                 // 1167
///                                                                                                              // 1168
/// PUBLISHING DATA                                                                                              // 1169
///                                                                                                              // 1170
                                                                                                                 // 1171
// Publish the current user's record to the client.                                                              // 1172
Meteor.publish(null, function() {                                                                                // 1173
  if (this.userId) {                                                                                             // 1174
    return Meteor.users.find(                                                                                    // 1175
      {_id: this.userId},                                                                                        // 1176
      {fields: {profile: 1, username: 1, emails: 1}});                                                           // 1177
  } else {                                                                                                       // 1178
    return null;                                                                                                 // 1179
  }                                                                                                              // 1180
}, /*suppress autopublish warning*/{is_auto: true});                                                             // 1181
                                                                                                                 // 1182
// If autopublish is on, publish these user fields. Login service                                                // 1183
// packages (eg accounts-google) add to these by calling                                                         // 1184
// Accounts.addAutopublishFields Notably, this isn't implemented with                                            // 1185
// multiple publishes since DDP only merges only across top-level                                                // 1186
// fields, not subfields (such as 'services.facebook.accessToken')                                               // 1187
var autopublishFields = {                                                                                        // 1188
  loggedInUser: ['profile', 'username', 'emails'],                                                               // 1189
  otherUsers: ['profile', 'username']                                                                            // 1190
};                                                                                                               // 1191
                                                                                                                 // 1192
// Add to the list of fields or subfields to be automatically                                                    // 1193
// published if autopublish is on. Must be called from top-level                                                 // 1194
// code (ie, before Meteor.startup hooks run).                                                                   // 1195
//                                                                                                               // 1196
// @param opts {Object} with:                                                                                    // 1197
//   - forLoggedInUser {Array} Array of fields published to the logged-in user                                   // 1198
//   - forOtherUsers {Array} Array of fields published to users that aren't logged in                            // 1199
Accounts.addAutopublishFields = function(opts) {                                                                 // 1200
  autopublishFields.loggedInUser.push.apply(                                                                     // 1201
    autopublishFields.loggedInUser, opts.forLoggedInUser);                                                       // 1202
  autopublishFields.otherUsers.push.apply(                                                                       // 1203
    autopublishFields.otherUsers, opts.forOtherUsers);                                                           // 1204
};                                                                                                               // 1205
                                                                                                                 // 1206
if (Package.autopublish) {                                                                                       // 1207
  // Use Meteor.startup to give other packages a chance to call                                                  // 1208
  // addAutopublishFields.                                                                                       // 1209
  Meteor.startup(function () {                                                                                   // 1210
    // ['profile', 'username'] -> {profile: 1, username: 1}                                                      // 1211
    var toFieldSelector = function(fields) {                                                                     // 1212
      return _.object(_.map(fields, function(field) {                                                            // 1213
        return [field, 1];                                                                                       // 1214
      }));                                                                                                       // 1215
    };                                                                                                           // 1216
                                                                                                                 // 1217
    Meteor.server.publish(null, function () {                                                                    // 1218
      if (this.userId) {                                                                                         // 1219
        return Meteor.users.find(                                                                                // 1220
          {_id: this.userId},                                                                                    // 1221
          {fields: toFieldSelector(autopublishFields.loggedInUser)});                                            // 1222
      } else {                                                                                                   // 1223
        return null;                                                                                             // 1224
      }                                                                                                          // 1225
    }, /*suppress autopublish warning*/{is_auto: true});                                                         // 1226
                                                                                                                 // 1227
    // XXX this publish is neither dedup-able nor is it optimized by our special                                 // 1228
    // treatment of queries on a specific _id. Therefore this will have O(n^2)                                   // 1229
    // run-time performance every time a user document is changed (eg someone                                    // 1230
    // logging in). If this is a problem, we can instead write a manual publish                                  // 1231
    // function which filters out fields based on 'this.userId'.                                                 // 1232
    Meteor.server.publish(null, function () {                                                                    // 1233
      var selector;                                                                                              // 1234
      if (this.userId)                                                                                           // 1235
        selector = {_id: {$ne: this.userId}};                                                                    // 1236
      else                                                                                                       // 1237
        selector = {};                                                                                           // 1238
                                                                                                                 // 1239
      return Meteor.users.find(                                                                                  // 1240
        selector,                                                                                                // 1241
        {fields: toFieldSelector(autopublishFields.otherUsers)});                                                // 1242
    }, /*suppress autopublish warning*/{is_auto: true});                                                         // 1243
  });                                                                                                            // 1244
}                                                                                                                // 1245
                                                                                                                 // 1246
// Publish all login service configuration fields other than secret.                                             // 1247
Meteor.publish("meteor.loginServiceConfiguration", function () {                                                 // 1248
  var ServiceConfiguration =                                                                                     // 1249
    Package['service-configuration'].ServiceConfiguration;                                                       // 1250
  return ServiceConfiguration.configurations.find({}, {fields: {secret: 0}});                                    // 1251
}, {is_auto: true}); // not techincally autopublish, but stops the warning.                                      // 1252
                                                                                                                 // 1253
// Allow a one-time configuration for a login service. Modifications                                             // 1254
// to this collection are also allowed in insecure mode.                                                         // 1255
Meteor.methods({                                                                                                 // 1256
  "configureLoginService": function (options) {                                                                  // 1257
    check(options, Match.ObjectIncluding({service: String}));                                                    // 1258
    // Don't let random users configure a service we haven't added yet (so                                       // 1259
    // that when we do later add it, it's set up with their configuration                                        // 1260
    // instead of ours).                                                                                         // 1261
    // XXX if service configuration is oauth-specific then this code should                                      // 1262
    //     be in accounts-oauth; if it's not then the registry should be                                         // 1263
    //     in this package                                                                                       // 1264
    if (!(Accounts.oauth                                                                                         // 1265
          && _.contains(Accounts.oauth.serviceNames(), options.service))) {                                      // 1266
      throw new Meteor.Error(403, "Service unknown");                                                            // 1267
    }                                                                                                            // 1268
                                                                                                                 // 1269
    var ServiceConfiguration =                                                                                   // 1270
      Package['service-configuration'].ServiceConfiguration;                                                     // 1271
    if (ServiceConfiguration.configurations.findOne({service: options.service}))                                 // 1272
      throw new Meteor.Error(403, "Service " + options.service + " already configured");                         // 1273
                                                                                                                 // 1274
    if (_.has(options, "secret") && usingOAuthEncryption())                                                      // 1275
      options.secret = OAuthEncryption.seal(options.secret);                                                     // 1276
                                                                                                                 // 1277
    ServiceConfiguration.configurations.insert(options);                                                         // 1278
  }                                                                                                              // 1279
});                                                                                                              // 1280
                                                                                                                 // 1281
                                                                                                                 // 1282
///                                                                                                              // 1283
/// RESTRICTING WRITES TO USER OBJECTS                                                                           // 1284
///                                                                                                              // 1285
                                                                                                                 // 1286
Meteor.users.allow({                                                                                             // 1287
  // clients can modify the profile field of their own document, and                                             // 1288
  // nothing else.                                                                                               // 1289
  update: function (userId, user, fields, modifier) {                                                            // 1290
    // make sure it is our record                                                                                // 1291
    if (user._id !== userId)                                                                                     // 1292
      return false;                                                                                              // 1293
                                                                                                                 // 1294
    // user can only modify the 'profile' field. sets to multiple                                                // 1295
    // sub-keys (eg profile.foo and profile.bar) are merged into entry                                           // 1296
    // in the fields list.                                                                                       // 1297
    if (fields.length !== 1 || fields[0] !== 'profile')                                                          // 1298
      return false;                                                                                              // 1299
                                                                                                                 // 1300
    return true;                                                                                                 // 1301
  },                                                                                                             // 1302
  fetch: ['_id'] // we only look at _id.                                                                         // 1303
});                                                                                                              // 1304
                                                                                                                 // 1305
/// DEFAULT INDEXES ON USERS                                                                                     // 1306
Meteor.users._ensureIndex('username', {unique: 1, sparse: 1});                                                   // 1307
Meteor.users._ensureIndex('emails.address', {unique: 1, sparse: 1});                                             // 1308
Meteor.users._ensureIndex('services.resume.loginTokens.hashedToken',                                             // 1309
                          {unique: 1, sparse: 1});                                                               // 1310
Meteor.users._ensureIndex('services.resume.loginTokens.token',                                                   // 1311
                          {unique: 1, sparse: 1});                                                               // 1312
// For taking care of logoutOtherClients calls that crashed before the tokens                                    // 1313
// were deleted.                                                                                                 // 1314
Meteor.users._ensureIndex('services.resume.haveLoginTokensToDelete',                                             // 1315
                          { sparse: 1 });                                                                        // 1316
// For expiring login tokens                                                                                     // 1317
Meteor.users._ensureIndex("services.resume.loginTokens.when", { sparse: 1 });                                    // 1318
                                                                                                                 // 1319
///                                                                                                              // 1320
/// CLEAN UP FOR `logoutOtherClients`                                                                            // 1321
///                                                                                                              // 1322
                                                                                                                 // 1323
var deleteSavedTokens = function (userId, tokensToDelete) {                                                      // 1324
  if (tokensToDelete) {                                                                                          // 1325
    Meteor.users.update(userId, {                                                                                // 1326
      $unset: {                                                                                                  // 1327
        "services.resume.haveLoginTokensToDelete": 1,                                                            // 1328
        "services.resume.loginTokensToDelete": 1                                                                 // 1329
      },                                                                                                         // 1330
      $pullAll: {                                                                                                // 1331
        "services.resume.loginTokens": tokensToDelete                                                            // 1332
      }                                                                                                          // 1333
    });                                                                                                          // 1334
  }                                                                                                              // 1335
};                                                                                                               // 1336
                                                                                                                 // 1337
Meteor.startup(function () {                                                                                     // 1338
  // If we find users who have saved tokens to delete on startup, delete them                                    // 1339
  // now. It's possible that the server could have crashed and come back up                                      // 1340
  // before new tokens are found in localStorage, but this shouldn't happen very                                 // 1341
  // often. We shouldn't put a delay here because that would give a lot of power                                 // 1342
  // to an attacker with a stolen login token and the ability to crash the                                       // 1343
  // server.                                                                                                     // 1344
  var users = Meteor.users.find({                                                                                // 1345
    "services.resume.haveLoginTokensToDelete": true                                                              // 1346
  }, {                                                                                                           // 1347
    "services.resume.loginTokensToDelete": 1                                                                     // 1348
  });                                                                                                            // 1349
  users.forEach(function (user) {                                                                                // 1350
    deleteSavedTokens(user._id, user.services.resume.loginTokensToDelete);                                       // 1351
  });                                                                                                            // 1352
});                                                                                                              // 1353
                                                                                                                 // 1354
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/accounts-base/url_server.js                                                                          //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
// XXX These should probably not actually be public?                                                             // 1
                                                                                                                 // 2
Accounts.urls = {};                                                                                              // 3
                                                                                                                 // 4
Accounts.urls.resetPassword = function (token) {                                                                 // 5
  return Meteor.absoluteUrl('#/reset-password/' + token);                                                        // 6
};                                                                                                               // 7
                                                                                                                 // 8
Accounts.urls.verifyEmail = function (token) {                                                                   // 9
  return Meteor.absoluteUrl('#/verify-email/' + token);                                                          // 10
};                                                                                                               // 11
                                                                                                                 // 12
Accounts.urls.enrollAccount = function (token) {                                                                 // 13
  return Meteor.absoluteUrl('#/enroll-account/' + token);                                                        // 14
};                                                                                                               // 15
                                                                                                                 // 16
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['accounts-base'] = {
  Accounts: Accounts
};

})();
