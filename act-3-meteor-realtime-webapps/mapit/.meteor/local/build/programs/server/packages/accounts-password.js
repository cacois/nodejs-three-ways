(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Accounts = Package['accounts-base'].Accounts;
var SRP = Package.srp.SRP;
var Email = Package.email.Email;
var Random = Package.random.Random;
var check = Package.check.check;
var Match = Package.check.Match;
var _ = Package.underscore._;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/accounts-password/email_templates.js                                              //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
Accounts.emailTemplates = {                                                                   // 1
  from: "Meteor Accounts <no-reply@meteor.com>",                                              // 2
  siteName: Meteor.absoluteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''),              // 3
                                                                                              // 4
  resetPassword: {                                                                            // 5
    subject: function(user) {                                                                 // 6
      return "How to reset your password on " + Accounts.emailTemplates.siteName;             // 7
    },                                                                                        // 8
    text: function(user, url) {                                                               // 9
      var greeting = (user.profile && user.profile.name) ?                                    // 10
            ("Hello " + user.profile.name + ",") : "Hello,";                                  // 11
      return greeting + "\n"                                                                  // 12
        + "\n"                                                                                // 13
        + "To reset your password, simply click the link below.\n"                            // 14
        + "\n"                                                                                // 15
        + url + "\n"                                                                          // 16
        + "\n"                                                                                // 17
        + "Thanks.\n";                                                                        // 18
    }                                                                                         // 19
  },                                                                                          // 20
  verifyEmail: {                                                                              // 21
    subject: function(user) {                                                                 // 22
      return "How to verify email address on " + Accounts.emailTemplates.siteName;            // 23
    },                                                                                        // 24
    text: function(user, url) {                                                               // 25
      var greeting = (user.profile && user.profile.name) ?                                    // 26
            ("Hello " + user.profile.name + ",") : "Hello,";                                  // 27
      return greeting + "\n"                                                                  // 28
        + "\n"                                                                                // 29
        + "To verify your account email, simply click the link below.\n"                      // 30
        + "\n"                                                                                // 31
        + url + "\n"                                                                          // 32
        + "\n"                                                                                // 33
        + "Thanks.\n";                                                                        // 34
    }                                                                                         // 35
  },                                                                                          // 36
  enrollAccount: {                                                                            // 37
    subject: function(user) {                                                                 // 38
      return "An account has been created for you on " + Accounts.emailTemplates.siteName;    // 39
    },                                                                                        // 40
    text: function(user, url) {                                                               // 41
      var greeting = (user.profile && user.profile.name) ?                                    // 42
            ("Hello " + user.profile.name + ",") : "Hello,";                                  // 43
      return greeting + "\n"                                                                  // 44
        + "\n"                                                                                // 45
        + "To start using the service, simply click the link below.\n"                        // 46
        + "\n"                                                                                // 47
        + url + "\n"                                                                          // 48
        + "\n"                                                                                // 49
        + "Thanks.\n";                                                                        // 50
    }                                                                                         // 51
  }                                                                                           // 52
};                                                                                            // 53
                                                                                              // 54
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/accounts-password/password_server.js                                              //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
///                                                                                           // 1
/// LOGIN                                                                                     // 2
///                                                                                           // 3
                                                                                              // 4
// Users can specify various keys to identify themselves with.                                // 5
// @param user {Object} with one of `id`, `username`, or `email`.                             // 6
// @returns A selector to pass to mongo to get the user record.                               // 7
                                                                                              // 8
var selectorFromUserQuery = function (user) {                                                 // 9
  if (user.id)                                                                                // 10
    return {_id: user.id};                                                                    // 11
  else if (user.username)                                                                     // 12
    return {username: user.username};                                                         // 13
  else if (user.email)                                                                        // 14
    return {"emails.address": user.email};                                                    // 15
  throw new Error("shouldn't happen (validation missed something)");                          // 16
};                                                                                            // 17
                                                                                              // 18
// XXX maybe this belongs in the check package                                                // 19
var NonEmptyString = Match.Where(function (x) {                                               // 20
  check(x, String);                                                                           // 21
  return x.length > 0;                                                                        // 22
});                                                                                           // 23
                                                                                              // 24
var userQueryValidator = Match.Where(function (user) {                                        // 25
  check(user, {                                                                               // 26
    id: Match.Optional(NonEmptyString),                                                       // 27
    username: Match.Optional(NonEmptyString),                                                 // 28
    email: Match.Optional(NonEmptyString)                                                     // 29
  });                                                                                         // 30
  if (_.keys(user).length !== 1)                                                              // 31
    throw new Match.Error("User property must have exactly one field");                       // 32
  return true;                                                                                // 33
});                                                                                           // 34
                                                                                              // 35
// Step 1 of SRP password exchange. This puts an `M` value in the                             // 36
// session data for this connection. If a client later sends the same                         // 37
// `M` value to a method on this connection, it proves they know the                          // 38
// password for this user. We can then prove we know the password to                          // 39
// them by sending our `HAMK` value.                                                          // 40
//                                                                                            // 41
// @param request {Object} with fields:                                                       // 42
//   user: either {username: (username)}, {email: (email)}, or {id: (userId)}                 // 43
//   A: hex encoded int. the client's public key for this exchange                            // 44
// @returns {Object} with fields:                                                             // 45
//   identity: random string ID                                                               // 46
//   salt: random string ID                                                                   // 47
//   B: hex encoded int. server's public key for this exchange                                // 48
Meteor.methods({beginPasswordExchange: function (request) {                                   // 49
  var self = this;                                                                            // 50
  try {                                                                                       // 51
    check(request, {                                                                          // 52
      user: userQueryValidator,                                                               // 53
      A: String                                                                               // 54
    });                                                                                       // 55
    var selector = selectorFromUserQuery(request.user);                                       // 56
                                                                                              // 57
    var user = Meteor.users.findOne(selector);                                                // 58
    if (!user)                                                                                // 59
      throw new Meteor.Error(403, "User not found");                                          // 60
                                                                                              // 61
    if (!user.services || !user.services.password ||                                          // 62
        !user.services.password.srp)                                                          // 63
      throw new Meteor.Error(403, "User has no password set");                                // 64
                                                                                              // 65
    var verifier = user.services.password.srp;                                                // 66
    var srp = new SRP.Server(verifier);                                                       // 67
    var challenge = srp.issueChallenge({A: request.A});                                       // 68
                                                                                              // 69
  } catch (err) {                                                                             // 70
    // Report login failure if the method fails, so that login hooks are                      // 71
    // called. If the method succeeds, login hooks will be called when                        // 72
    // the second step method ('login') is called. If a user calls                            // 73
    // 'beginPasswordExchange' but then never calls the second step                           // 74
    // 'login' method, no login hook will fire.                                               // 75
    // The validate login hooks can mutate the exception to be thrown.                        // 76
    var attempt = Accounts._reportLoginFailure(self, 'beginPasswordExchange', arguments, {    // 77
      type: 'password',                                                                       // 78
      error: err,                                                                             // 79
      userId: user && user._id                                                                // 80
    });                                                                                       // 81
    throw attempt.error;                                                                      // 82
  }                                                                                           // 83
                                                                                              // 84
  // Save results so we can verify them later.                                                // 85
  Accounts._setAccountData(this.connection.id, 'srpChallenge',                                // 86
    { userId: user._id, M: srp.M, HAMK: srp.HAMK }                                            // 87
  );                                                                                          // 88
  return challenge;                                                                           // 89
}});                                                                                          // 90
                                                                                              // 91
// Handler to login with password via SRP. Checks the `M` value set by                        // 92
// beginPasswordExchange.                                                                     // 93
Accounts.registerLoginHandler("password", function (options) {                                // 94
  if (!options.srp)                                                                           // 95
    return undefined; // don't handle                                                         // 96
  check(options.srp, {M: String});                                                            // 97
                                                                                              // 98
  // we're always called from within a 'login' method, so this should                         // 99
  // be safe.                                                                                 // 100
  var currentInvocation = DDP._CurrentInvocation.get();                                       // 101
  var serialized = Accounts._getAccountData(currentInvocation.connection.id, 'srpChallenge'); // 102
  if (!serialized || serialized.M !== options.srp.M)                                          // 103
    return {                                                                                  // 104
      userId: serialized && serialized.userId,                                                // 105
      error: new Meteor.Error(403, "Incorrect password")                                      // 106
    };                                                                                        // 107
  // Only can use challenges once.                                                            // 108
  Accounts._setAccountData(currentInvocation.connection.id, 'srpChallenge', undefined);       // 109
                                                                                              // 110
  var userId = serialized.userId;                                                             // 111
  var user = Meteor.users.findOne(userId);                                                    // 112
  // Was the user deleted since the start of this challenge?                                  // 113
  if (!user)                                                                                  // 114
    return {                                                                                  // 115
      userId: userId,                                                                         // 116
      error: new Meteor.Error(403, "User not found")                                          // 117
    };                                                                                        // 118
                                                                                              // 119
  return {                                                                                    // 120
    userId: userId,                                                                           // 121
    options: {HAMK: serialized.HAMK}                                                          // 122
  };                                                                                          // 123
});                                                                                           // 124
                                                                                              // 125
// Handler to login with plaintext password.                                                  // 126
//                                                                                            // 127
// The meteor client doesn't use this, it is for other DDP clients who                        // 128
// haven't implemented SRP. Since it sends the password in plaintext                          // 129
// over the wire, it should only be run over SSL!                                             // 130
//                                                                                            // 131
// Also, it might be nice if servers could turn this off. Or maybe it                         // 132
// should be opt-in, not opt-out? Accounts.config option?                                     // 133
Accounts.registerLoginHandler("password", function (options) {                                // 134
  if (!options.password || !options.user)                                                     // 135
    return undefined; // don't handle                                                         // 136
                                                                                              // 137
  check(options, {user: userQueryValidator, password: String});                               // 138
                                                                                              // 139
  var selector = selectorFromUserQuery(options.user);                                         // 140
  var user = Meteor.users.findOne(selector);                                                  // 141
  if (!user)                                                                                  // 142
    throw new Meteor.Error(403, "User not found");                                            // 143
                                                                                              // 144
  if (!user.services || !user.services.password ||                                            // 145
      !user.services.password.srp)                                                            // 146
    return {                                                                                  // 147
      userId: user._id,                                                                       // 148
      error: new Meteor.Error(403, "User has no password set")                                // 149
    };                                                                                        // 150
                                                                                              // 151
  // Just check the verifier output when the same identity and salt                           // 152
  // are passed. Don't bother with a full exchange.                                           // 153
  var verifier = user.services.password.srp;                                                  // 154
  var newVerifier = SRP.generateVerifier(options.password, {                                  // 155
    identity: verifier.identity, salt: verifier.salt});                                       // 156
                                                                                              // 157
  if (verifier.verifier !== newVerifier.verifier)                                             // 158
    return {                                                                                  // 159
      userId: user._id,                                                                       // 160
      error: new Meteor.Error(403, "Incorrect password")                                      // 161
    };                                                                                        // 162
                                                                                              // 163
  return {userId: user._id};                                                                  // 164
});                                                                                           // 165
                                                                                              // 166
                                                                                              // 167
///                                                                                           // 168
/// CHANGING                                                                                  // 169
///                                                                                           // 170
                                                                                              // 171
// Let the user change their own password if they know the old                                // 172
// password. Checks the `M` value set by beginPasswordExchange.                               // 173
Meteor.methods({changePassword: function (options) {                                          // 174
  if (!this.userId)                                                                           // 175
    throw new Meteor.Error(401, "Must be logged in");                                         // 176
  check(options, {                                                                            // 177
    // If options.M is set, it means we went through a challenge with the old                 // 178
    // password. For now, we don't allow changePassword without knowing the old               // 179
    // password.                                                                              // 180
    M: String,                                                                                // 181
    srp: Match.Optional(SRP.matchVerifier),                                                   // 182
    password: Match.Optional(String)                                                          // 183
  });                                                                                         // 184
                                                                                              // 185
  var serialized = Accounts._getAccountData(this.connection.id, 'srpChallenge');              // 186
  if (!serialized || serialized.M !== options.M)                                              // 187
    throw new Meteor.Error(403, "Incorrect password");                                        // 188
  if (serialized.userId !== this.userId)                                                      // 189
    // No monkey business!                                                                    // 190
    throw new Meteor.Error(403, "Incorrect password");                                        // 191
  // Only can use challenges once.                                                            // 192
  Accounts._setAccountData(this.connection.id, 'srpChallenge', undefined);                    // 193
                                                                                              // 194
  var verifier = options.srp;                                                                 // 195
  if (!verifier && options.password) {                                                        // 196
    verifier = SRP.generateVerifier(options.password);                                        // 197
  }                                                                                           // 198
  if (!verifier)                                                                              // 199
    throw new Meteor.Error(400, "Invalid verifier");                                          // 200
                                                                                              // 201
  // It would be better if this removed ALL existing tokens and replaced                      // 202
  // the token for the current connection with a new one, but that would                      // 203
  // be tricky, so we'll settle for just replacing all tokens other than                      // 204
  // the one for the current connection.                                                      // 205
  var currentToken = Accounts._getLoginToken(this.connection.id);                             // 206
  Meteor.users.update(                                                                        // 207
    { _id: this.userId },                                                                     // 208
    {                                                                                         // 209
      $set: { 'services.password.srp': verifier },                                            // 210
      $pull: {                                                                                // 211
        'services.resume.loginTokens': { hashedToken: { $ne: currentToken } }                 // 212
      }                                                                                       // 213
    }                                                                                         // 214
  );                                                                                          // 215
                                                                                              // 216
  var ret = {passwordChanged: true};                                                          // 217
  if (serialized)                                                                             // 218
    ret.HAMK = serialized.HAMK;                                                               // 219
  return ret;                                                                                 // 220
}});                                                                                          // 221
                                                                                              // 222
                                                                                              // 223
// Force change the users password.                                                           // 224
Accounts.setPassword = function (userId, newPassword) {                                       // 225
  var user = Meteor.users.findOne(userId);                                                    // 226
  if (!user)                                                                                  // 227
    throw new Meteor.Error(403, "User not found");                                            // 228
  var newVerifier = SRP.generateVerifier(newPassword);                                        // 229
                                                                                              // 230
  Meteor.users.update({_id: user._id}, {                                                      // 231
    $set: {'services.password.srp': newVerifier}});                                           // 232
};                                                                                            // 233
                                                                                              // 234
                                                                                              // 235
///                                                                                           // 236
/// RESETTING VIA EMAIL                                                                       // 237
///                                                                                           // 238
                                                                                              // 239
// Method called by a user to request a password reset email. This is                         // 240
// the start of the reset process.                                                            // 241
Meteor.methods({forgotPassword: function (options) {                                          // 242
  check(options, {email: String});                                                            // 243
                                                                                              // 244
  var user = Meteor.users.findOne({"emails.address": options.email});                         // 245
  if (!user)                                                                                  // 246
    throw new Meteor.Error(403, "User not found");                                            // 247
                                                                                              // 248
  Accounts.sendResetPasswordEmail(user._id, options.email);                                   // 249
}});                                                                                          // 250
                                                                                              // 251
// send the user an email with a link that when opened allows the user                        // 252
// to set a new password, without the old password.                                           // 253
//                                                                                            // 254
Accounts.sendResetPasswordEmail = function (userId, email) {                                  // 255
  // Make sure the user exists, and email is one of their addresses.                          // 256
  var user = Meteor.users.findOne(userId);                                                    // 257
  if (!user)                                                                                  // 258
    throw new Error("Can't find user");                                                       // 259
  // pick the first email if we weren't passed an email.                                      // 260
  if (!email && user.emails && user.emails[0])                                                // 261
    email = user.emails[0].address;                                                           // 262
  // make sure we have a valid email                                                          // 263
  if (!email || !_.contains(_.pluck(user.emails || [], 'address'), email))                    // 264
    throw new Error("No such email for user.");                                               // 265
                                                                                              // 266
  var token = Random.secret();                                                                // 267
  var when = new Date();                                                                      // 268
  Meteor.users.update(userId, {$set: {                                                        // 269
    "services.password.reset": {                                                              // 270
      token: token,                                                                           // 271
      email: email,                                                                           // 272
      when: when                                                                              // 273
    }                                                                                         // 274
  }});                                                                                        // 275
                                                                                              // 276
  var resetPasswordUrl = Accounts.urls.resetPassword(token);                                  // 277
                                                                                              // 278
  var options = {                                                                             // 279
    to: email,                                                                                // 280
    from: Accounts.emailTemplates.from,                                                       // 281
    subject: Accounts.emailTemplates.resetPassword.subject(user),                             // 282
    text: Accounts.emailTemplates.resetPassword.text(user, resetPasswordUrl)                  // 283
  };                                                                                          // 284
                                                                                              // 285
  if (typeof Accounts.emailTemplates.resetPassword.html === 'function')                       // 286
    options.html =                                                                            // 287
      Accounts.emailTemplates.resetPassword.html(user, resetPasswordUrl);                     // 288
                                                                                              // 289
  Email.send(options);                                                                        // 290
};                                                                                            // 291
                                                                                              // 292
// send the user an email informing them that their account was created, with                 // 293
// a link that when opened both marks their email as verified and forces them                 // 294
// to choose their password. The email must be one of the addresses in the                    // 295
// user's emails field, or undefined to pick the first email automatically.                   // 296
//                                                                                            // 297
// This is not called automatically. It must be called manually if you                        // 298
// want to use enrollment emails.                                                             // 299
//                                                                                            // 300
Accounts.sendEnrollmentEmail = function (userId, email) {                                     // 301
  // XXX refactor! This is basically identical to sendResetPasswordEmail.                     // 302
                                                                                              // 303
  // Make sure the user exists, and email is in their addresses.                              // 304
  var user = Meteor.users.findOne(userId);                                                    // 305
  if (!user)                                                                                  // 306
    throw new Error("Can't find user");                                                       // 307
  // pick the first email if we weren't passed an email.                                      // 308
  if (!email && user.emails && user.emails[0])                                                // 309
    email = user.emails[0].address;                                                           // 310
  // make sure we have a valid email                                                          // 311
  if (!email || !_.contains(_.pluck(user.emails || [], 'address'), email))                    // 312
    throw new Error("No such email for user.");                                               // 313
                                                                                              // 314
                                                                                              // 315
  var token = Random.secret();                                                                // 316
  var when = new Date();                                                                      // 317
  Meteor.users.update(userId, {$set: {                                                        // 318
    "services.password.reset": {                                                              // 319
      token: token,                                                                           // 320
      email: email,                                                                           // 321
      when: when                                                                              // 322
    }                                                                                         // 323
  }});                                                                                        // 324
                                                                                              // 325
  var enrollAccountUrl = Accounts.urls.enrollAccount(token);                                  // 326
                                                                                              // 327
  var options = {                                                                             // 328
    to: email,                                                                                // 329
    from: Accounts.emailTemplates.from,                                                       // 330
    subject: Accounts.emailTemplates.enrollAccount.subject(user),                             // 331
    text: Accounts.emailTemplates.enrollAccount.text(user, enrollAccountUrl)                  // 332
  };                                                                                          // 333
                                                                                              // 334
  if (typeof Accounts.emailTemplates.enrollAccount.html === 'function')                       // 335
    options.html =                                                                            // 336
      Accounts.emailTemplates.enrollAccount.html(user, enrollAccountUrl);                     // 337
                                                                                              // 338
  Email.send(options);                                                                        // 339
};                                                                                            // 340
                                                                                              // 341
                                                                                              // 342
// Take token from sendResetPasswordEmail or sendEnrollmentEmail, change                      // 343
// the users password, and log them in.                                                       // 344
Meteor.methods({resetPassword: function (token, newVerifier) {                                // 345
  var self = this;                                                                            // 346
  return Accounts._loginMethod(                                                               // 347
    self,                                                                                     // 348
    "resetPassword",                                                                          // 349
    arguments,                                                                                // 350
    "password",                                                                               // 351
    function () {                                                                             // 352
      check(token, String);                                                                   // 353
      check(newVerifier, SRP.matchVerifier);                                                  // 354
                                                                                              // 355
      var user = Meteor.users.findOne({                                                       // 356
        "services.password.reset.token": ""+token});                                          // 357
      if (!user)                                                                              // 358
        throw new Meteor.Error(403, "Token expired");                                         // 359
      var email = user.services.password.reset.email;                                         // 360
      if (!_.include(_.pluck(user.emails || [], 'address'), email))                           // 361
        return {                                                                              // 362
          userId: user._id,                                                                   // 363
          error: new Meteor.Error(403, "Token has invalid email address")                     // 364
        };                                                                                    // 365
                                                                                              // 366
      // NOTE: We're about to invalidate tokens on the user, who we might be                  // 367
      // logged in as. Make sure to avoid logging ourselves out if this                       // 368
      // happens. But also make sure not to leave the connection in a state                   // 369
      // of having a bad token set if things fail.                                            // 370
      var oldToken = Accounts._getLoginToken(self.connection.id);                             // 371
      Accounts._setLoginToken(user._id, self.connection, null);                               // 372
      var resetToOldToken = function () {                                                     // 373
        Accounts._setLoginToken(user._id, self.connection, oldToken);                         // 374
      };                                                                                      // 375
                                                                                              // 376
      try {                                                                                   // 377
        // Update the user record by:                                                         // 378
        // - Changing the password verifier to the new one                                    // 379
        // - Forgetting about the reset token that was just used                              // 380
        // - Verifying their email, since they got the password reset via email.              // 381
        var affectedRecords = Meteor.users.update(                                            // 382
          {                                                                                   // 383
            _id: user._id,                                                                    // 384
            'emails.address': email,                                                          // 385
            'services.password.reset.token': token                                            // 386
          },                                                                                  // 387
          {$set: {'services.password.srp': newVerifier,                                       // 388
                  'emails.$.verified': true},                                                 // 389
           $unset: {'services.password.reset': 1}});                                          // 390
        if (affectedRecords !== 1)                                                            // 391
          return {                                                                            // 392
            userId: user._id,                                                                 // 393
            error: new Meteor.Error(403, "Invalid email")                                     // 394
          };                                                                                  // 395
      } catch (err) {                                                                         // 396
        resetToOldToken();                                                                    // 397
        throw err;                                                                            // 398
      }                                                                                       // 399
                                                                                              // 400
      // Replace all valid login tokens with new ones (changing                               // 401
      // password should invalidate existing sessions).                                       // 402
      Accounts._clearAllLoginTokens(user._id);                                                // 403
                                                                                              // 404
      return {userId: user._id};                                                              // 405
    }                                                                                         // 406
  );                                                                                          // 407
}});                                                                                          // 408
                                                                                              // 409
///                                                                                           // 410
/// EMAIL VERIFICATION                                                                        // 411
///                                                                                           // 412
                                                                                              // 413
                                                                                              // 414
// send the user an email with a link that when opened marks that                             // 415
// address as verified                                                                        // 416
//                                                                                            // 417
Accounts.sendVerificationEmail = function (userId, address) {                                 // 418
  // XXX Also generate a link using which someone can delete this                             // 419
  // account if they own said address but weren't those who created                           // 420
  // this account.                                                                            // 421
                                                                                              // 422
  // Make sure the user exists, and address is one of their addresses.                        // 423
  var user = Meteor.users.findOne(userId);                                                    // 424
  if (!user)                                                                                  // 425
    throw new Error("Can't find user");                                                       // 426
  // pick the first unverified address if we weren't passed an address.                       // 427
  if (!address) {                                                                             // 428
    var email = _.find(user.emails || [],                                                     // 429
                       function (e) { return !e.verified; });                                 // 430
    address = (email || {}).address;                                                          // 431
  }                                                                                           // 432
  // make sure we have a valid address                                                        // 433
  if (!address || !_.contains(_.pluck(user.emails || [], 'address'), address))                // 434
    throw new Error("No such email address for user.");                                       // 435
                                                                                              // 436
                                                                                              // 437
  var tokenRecord = {                                                                         // 438
    token: Random.secret(),                                                                   // 439
    address: address,                                                                         // 440
    when: new Date()};                                                                        // 441
  Meteor.users.update(                                                                        // 442
    {_id: userId},                                                                            // 443
    {$push: {'services.email.verificationTokens': tokenRecord}});                             // 444
                                                                                              // 445
  var verifyEmailUrl = Accounts.urls.verifyEmail(tokenRecord.token);                          // 446
                                                                                              // 447
  var options = {                                                                             // 448
    to: address,                                                                              // 449
    from: Accounts.emailTemplates.from,                                                       // 450
    subject: Accounts.emailTemplates.verifyEmail.subject(user),                               // 451
    text: Accounts.emailTemplates.verifyEmail.text(user, verifyEmailUrl)                      // 452
  };                                                                                          // 453
                                                                                              // 454
  if (typeof Accounts.emailTemplates.verifyEmail.html === 'function')                         // 455
    options.html =                                                                            // 456
      Accounts.emailTemplates.verifyEmail.html(user, verifyEmailUrl);                         // 457
                                                                                              // 458
  Email.send(options);                                                                        // 459
};                                                                                            // 460
                                                                                              // 461
// Take token from sendVerificationEmail, mark the email as verified,                         // 462
// and log them in.                                                                           // 463
Meteor.methods({verifyEmail: function (token) {                                               // 464
  var self = this;                                                                            // 465
  return Accounts._loginMethod(                                                               // 466
    self,                                                                                     // 467
    "verifyEmail",                                                                            // 468
    arguments,                                                                                // 469
    "password",                                                                               // 470
    function () {                                                                             // 471
      check(token, String);                                                                   // 472
                                                                                              // 473
      var user = Meteor.users.findOne(                                                        // 474
        {'services.email.verificationTokens.token': token});                                  // 475
      if (!user)                                                                              // 476
        throw new Meteor.Error(403, "Verify email link expired");                             // 477
                                                                                              // 478
      var tokenRecord = _.find(user.services.email.verificationTokens,                        // 479
                               function (t) {                                                 // 480
                                 return t.token == token;                                     // 481
                               });                                                            // 482
      if (!tokenRecord)                                                                       // 483
        return {                                                                              // 484
          userId: user._id,                                                                   // 485
          error: new Meteor.Error(403, "Verify email link expired")                           // 486
        };                                                                                    // 487
                                                                                              // 488
      var emailsRecord = _.find(user.emails, function (e) {                                   // 489
        return e.address == tokenRecord.address;                                              // 490
      });                                                                                     // 491
      if (!emailsRecord)                                                                      // 492
        return {                                                                              // 493
          userId: user._id,                                                                   // 494
          error: new Meteor.Error(403, "Verify email link is for unknown address")            // 495
        };                                                                                    // 496
                                                                                              // 497
      // By including the address in the query, we can use 'emails.$' in the                  // 498
      // modifier to get a reference to the specific object in the emails                     // 499
      // array. See                                                                           // 500
      // http://www.mongodb.org/display/DOCS/Updating/#Updating-The%24positionaloperator)     // 501
      // http://www.mongodb.org/display/DOCS/Updating#Updating-%24pull                        // 502
      Meteor.users.update(                                                                    // 503
        {_id: user._id,                                                                       // 504
         'emails.address': tokenRecord.address},                                              // 505
        {$set: {'emails.$.verified': true},                                                   // 506
         $pull: {'services.email.verificationTokens': {token: token}}});                      // 507
                                                                                              // 508
      return {userId: user._id};                                                              // 509
    }                                                                                         // 510
  );                                                                                          // 511
}});                                                                                          // 512
                                                                                              // 513
                                                                                              // 514
                                                                                              // 515
///                                                                                           // 516
/// CREATING USERS                                                                            // 517
///                                                                                           // 518
                                                                                              // 519
// Shared createUser function called from the createUser method, both                         // 520
// if originates in client or server code. Calls user provided hooks,                         // 521
// does the actual user insertion.                                                            // 522
//                                                                                            // 523
// returns the user id                                                                        // 524
var createUser = function (options) {                                                         // 525
  // Unknown keys allowed, because a onCreateUserHook can take arbitrary                      // 526
  // options.                                                                                 // 527
  check(options, Match.ObjectIncluding({                                                      // 528
    username: Match.Optional(String),                                                         // 529
    email: Match.Optional(String),                                                            // 530
    password: Match.Optional(String),                                                         // 531
    srp: Match.Optional(SRP.matchVerifier)                                                    // 532
  }));                                                                                        // 533
                                                                                              // 534
  var username = options.username;                                                            // 535
  var email = options.email;                                                                  // 536
  if (!username && !email)                                                                    // 537
    throw new Meteor.Error(400, "Need to set a username or email");                           // 538
                                                                                              // 539
  // Raw password. The meteor client doesn't send this, but a DDP                             // 540
  // client that didn't implement SRP could send this. This should                            // 541
  // only be done over SSL.                                                                   // 542
  if (options.password) {                                                                     // 543
    if (options.srp)                                                                          // 544
      throw new Meteor.Error(400, "Don't pass both password and srp in options");             // 545
    options.srp = SRP.generateVerifier(options.password);                                     // 546
  }                                                                                           // 547
                                                                                              // 548
  var user = {services: {}};                                                                  // 549
  if (options.srp)                                                                            // 550
    user.services.password = {srp: options.srp}; // XXX validate verifier                     // 551
  if (username)                                                                               // 552
    user.username = username;                                                                 // 553
  if (email)                                                                                  // 554
    user.emails = [{address: email, verified: false}];                                        // 555
                                                                                              // 556
  return Accounts.insertUserDoc(options, user);                                               // 557
};                                                                                            // 558
                                                                                              // 559
// method for create user. Requests come from the client.                                     // 560
Meteor.methods({createUser: function (options) {                                              // 561
  var self = this;                                                                            // 562
  return Accounts._loginMethod(                                                               // 563
    self,                                                                                     // 564
    "createUser",                                                                             // 565
    arguments,                                                                                // 566
    "password",                                                                               // 567
    function () {                                                                             // 568
      // createUser() above does more checking.                                               // 569
      check(options, Object);                                                                 // 570
      if (Accounts._options.forbidClientAccountCreation)                                      // 571
        return {                                                                              // 572
          error: new Meteor.Error(403, "Signups forbidden")                                   // 573
        };                                                                                    // 574
                                                                                              // 575
      // Create user. result contains id and token.                                           // 576
      var userId = createUser(options);                                                       // 577
      // safety belt. createUser is supposed to throw on error. send 500 error                // 578
      // instead of sending a verification email with empty userid.                           // 579
      if (! userId)                                                                           // 580
        throw new Error("createUser failed to insert new user");                              // 581
                                                                                              // 582
      // If `Accounts._options.sendVerificationEmail` is set, register                        // 583
      // a token to verify the user's primary email, and send it to                           // 584
      // that address.                                                                        // 585
      if (options.email && Accounts._options.sendVerificationEmail)                           // 586
        Accounts.sendVerificationEmail(userId, options.email);                                // 587
                                                                                              // 588
      // client gets logged in as the new user afterwards.                                    // 589
      return {userId: userId};                                                                // 590
    }                                                                                         // 591
  );                                                                                          // 592
}});                                                                                          // 593
                                                                                              // 594
// Create user directly on the server.                                                        // 595
//                                                                                            // 596
// Unlike the client version, this does not log you in as this user                           // 597
// after creation.                                                                            // 598
//                                                                                            // 599
// returns userId or throws an error if it can't create                                       // 600
//                                                                                            // 601
// XXX add another argument ("server options") that gets sent to onCreateUser,                // 602
// which is always empty when called from the createUser method? eg, "admin:                  // 603
// true", which we want to prevent the client from setting, but which a custom                // 604
// method calling Accounts.createUser could set?                                              // 605
//                                                                                            // 606
Accounts.createUser = function (options, callback) {                                          // 607
  options = _.clone(options);                                                                 // 608
                                                                                              // 609
  // XXX allow an optional callback?                                                          // 610
  if (callback) {                                                                             // 611
    throw new Error("Accounts.createUser with callback not supported on the server yet.");    // 612
  }                                                                                           // 613
                                                                                              // 614
  return createUser(options);                                                                 // 615
};                                                                                            // 616
                                                                                              // 617
///                                                                                           // 618
/// PASSWORD-SPECIFIC INDEXES ON USERS                                                        // 619
///                                                                                           // 620
Meteor.users._ensureIndex('emails.validationTokens.token',                                    // 621
                          {unique: 1, sparse: 1});                                            // 622
Meteor.users._ensureIndex('services.password.reset.token',                                    // 623
                          {unique: 1, sparse: 1});                                            // 624
                                                                                              // 625
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['accounts-password'] = {};

})();
