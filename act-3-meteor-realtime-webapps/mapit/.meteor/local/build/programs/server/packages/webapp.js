(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Spacebars = Package.spacebars.Spacebars;
var HTML = Package.htmljs.HTML;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var HTMLTools = Package['html-tools'].HTMLTools;

/* Package-scope variables */
var WebApp, main, WebAppInternals;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/webapp/webapp_server.js                                                      //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
////////// Requires //////////                                                           // 1
                                                                                         // 2
var fs = Npm.require("fs");                                                              // 3
var http = Npm.require("http");                                                          // 4
var os = Npm.require("os");                                                              // 5
var path = Npm.require("path");                                                          // 6
var url = Npm.require("url");                                                            // 7
var crypto = Npm.require("crypto");                                                      // 8
                                                                                         // 9
var connect = Npm.require('connect');                                                    // 10
var useragent = Npm.require('useragent');                                                // 11
var send = Npm.require('send');                                                          // 12
                                                                                         // 13
var SHORT_SOCKET_TIMEOUT = 5*1000;                                                       // 14
var LONG_SOCKET_TIMEOUT = 120*1000;                                                      // 15
                                                                                         // 16
WebApp = {};                                                                             // 17
WebAppInternals = {};                                                                    // 18
                                                                                         // 19
var bundledJsCssPrefix;                                                                  // 20
                                                                                         // 21
// The reload safetybelt is some js that will be loaded after everything else in         // 22
// the HTML.  In some multi-server deployments, when you update, you have a              // 23
// chance of hitting an old server for the HTML and the new server for the JS or         // 24
// CSS.  This prevents you from displaying the page in that case, and instead            // 25
// reloads it, presumably all on the new version now.                                    // 26
var RELOAD_SAFETYBELT = "\n" +                                                           // 27
      "if (typeof Package === 'undefined' ||\n" +                                        // 28
      "    ! Package.webapp ||\n" +                                                      // 29
      "    ! Package.webapp.WebApp ||\n" +                                               // 30
      "    ! Package.webapp.WebApp._isCssLoaded())\n" +                                  // 31
      "  document.location.reload(); \n";                                                // 32
                                                                                         // 33
// Keepalives so that when the outer server dies unceremoniously and                     // 34
// doesn't kill us, we quit ourselves. A little gross, but better than                   // 35
// pidfiles.                                                                             // 36
// XXX This should really be part of the boot script, not the webapp package.            // 37
//     Or we should just get rid of it, and rely on containerization.                    // 38
                                                                                         // 39
var initKeepalive = function () {                                                        // 40
  var keepaliveCount = 0;                                                                // 41
                                                                                         // 42
  process.stdin.on('data', function (data) {                                             // 43
    keepaliveCount = 0;                                                                  // 44
  });                                                                                    // 45
                                                                                         // 46
  process.stdin.resume();                                                                // 47
                                                                                         // 48
  setInterval(function () {                                                              // 49
    keepaliveCount ++;                                                                   // 50
    if (keepaliveCount >= 3) {                                                           // 51
      console.log("Failed to receive keepalive! Exiting.");                              // 52
      process.exit(1);                                                                   // 53
    }                                                                                    // 54
  }, 3000);                                                                              // 55
};                                                                                       // 56
                                                                                         // 57
                                                                                         // 58
var sha1 = function (contents) {                                                         // 59
  var hash = crypto.createHash('sha1');                                                  // 60
  hash.update(contents);                                                                 // 61
  return hash.digest('hex');                                                             // 62
};                                                                                       // 63
                                                                                         // 64
// #BrowserIdentification                                                                // 65
//                                                                                       // 66
// We have multiple places that want to identify the browser: the                        // 67
// unsupported browser page, the appcache package, and, eventually                       // 68
// delivering browser polyfills only as needed.                                          // 69
//                                                                                       // 70
// To avoid detecting the browser in multiple places ad-hoc, we create a                 // 71
// Meteor "browser" object. It uses but does not expose the npm                          // 72
// useragent module (we could choose a different mechanism to identify                   // 73
// the browser in the future if we wanted to).  The browser object                       // 74
// contains                                                                              // 75
//                                                                                       // 76
// * `name`: the name of the browser in camel case                                       // 77
// * `major`, `minor`, `patch`: integers describing the browser version                  // 78
//                                                                                       // 79
// Also here is an early version of a Meteor `request` object, intended                  // 80
// to be a high-level description of the request without exposing                        // 81
// details of connect's low-level `req`.  Currently it contains:                         // 82
//                                                                                       // 83
// * `browser`: browser identification object described above                            // 84
// * `url`: parsed url, including parsed query params                                    // 85
//                                                                                       // 86
// As a temporary hack there is a `categorizeRequest` function on WebApp which           // 87
// converts a connect `req` to a Meteor `request`. This can go away once smart           // 88
// packages such as appcache are being passed a `request` object directly when           // 89
// they serve content.                                                                   // 90
//                                                                                       // 91
// This allows `request` to be used uniformly: it is passed to the html                  // 92
// attributes hook, and the appcache package can use it when deciding                    // 93
// whether to generate a 404 for the manifest.                                           // 94
//                                                                                       // 95
// Real routing / server side rendering will probably refactor this                      // 96
// heavily.                                                                              // 97
                                                                                         // 98
                                                                                         // 99
// e.g. "Mobile Safari" => "mobileSafari"                                                // 100
var camelCase = function (name) {                                                        // 101
  var parts = name.split(' ');                                                           // 102
  parts[0] = parts[0].toLowerCase();                                                     // 103
  for (var i = 1;  i < parts.length;  ++i) {                                             // 104
    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);                    // 105
  }                                                                                      // 106
  return parts.join('');                                                                 // 107
};                                                                                       // 108
                                                                                         // 109
var identifyBrowser = function (userAgentString) {                                       // 110
  var userAgent = useragent.lookup(userAgentString);                                     // 111
  return {                                                                               // 112
    name: camelCase(userAgent.family),                                                   // 113
    major: +userAgent.major,                                                             // 114
    minor: +userAgent.minor,                                                             // 115
    patch: +userAgent.patch                                                              // 116
  };                                                                                     // 117
};                                                                                       // 118
                                                                                         // 119
// XXX Refactor as part of implementing real routing.                                    // 120
WebAppInternals.identifyBrowser = identifyBrowser;                                       // 121
                                                                                         // 122
WebApp.categorizeRequest = function (req) {                                              // 123
  return {                                                                               // 124
    browser: identifyBrowser(req.headers['user-agent']),                                 // 125
    url: url.parse(req.url, true)                                                        // 126
  };                                                                                     // 127
};                                                                                       // 128
                                                                                         // 129
// HTML attribute hooks: functions to be called to determine any attributes to           // 130
// be added to the '<html>' tag. Each function is passed a 'request' object (see         // 131
// #BrowserIdentification) and should return a string,                                   // 132
var htmlAttributeHooks = [];                                                             // 133
var getHtmlAttributes = function (request) {                                             // 134
  var combinedAttributes  = {};                                                          // 135
  _.each(htmlAttributeHooks || [], function (hook) {                                     // 136
    var attributes = hook(request);                                                      // 137
    if (attributes === null)                                                             // 138
      return;                                                                            // 139
    if (typeof attributes !== 'object')                                                  // 140
      throw Error("HTML attribute hook must return null or object");                     // 141
    _.extend(combinedAttributes, attributes);                                            // 142
  });                                                                                    // 143
  return combinedAttributes;                                                             // 144
};                                                                                       // 145
WebApp.addHtmlAttributeHook = function (hook) {                                          // 146
  htmlAttributeHooks.push(hook);                                                         // 147
};                                                                                       // 148
                                                                                         // 149
// Serve app HTML for this URL?                                                          // 150
var appUrl = function (url) {                                                            // 151
  if (url === '/favicon.ico' || url === '/robots.txt')                                   // 152
    return false;                                                                        // 153
                                                                                         // 154
  // NOTE: app.manifest is not a web standard like favicon.ico and                       // 155
  // robots.txt. It is a file name we have chosen to use for HTML5                       // 156
  // appcache URLs. It is included here to prevent using an appcache                     // 157
  // then removing it from poisoning an app permanently. Eventually,                     // 158
  // once we have server side routing, this won't be needed as                           // 159
  // unknown URLs with return a 404 automatically.                                       // 160
  if (url === '/app.manifest')                                                           // 161
    return false;                                                                        // 162
                                                                                         // 163
  // Avoid serving app HTML for declared routes such as /sockjs/.                        // 164
  if (RoutePolicy.classify(url))                                                         // 165
    return false;                                                                        // 166
                                                                                         // 167
  // we currently return app HTML on all URLs by default                                 // 168
  return true;                                                                           // 169
};                                                                                       // 170
                                                                                         // 171
                                                                                         // 172
// Calculate a hash of all the client resources downloaded by the                        // 173
// browser, including the application HTML, runtime config, code, and                    // 174
// static files.                                                                         // 175
//                                                                                       // 176
// This hash *must* change if any resources seen by the browser                          // 177
// change, and ideally *doesn't* change for any server-only changes                      // 178
// (but the second is a performance enhancement, not a hard                              // 179
// requirement).                                                                         // 180
                                                                                         // 181
var calculateClientHash = function () {                                                  // 182
  var hash = crypto.createHash('sha1');                                                  // 183
  hash.update(JSON.stringify(__meteor_runtime_config__), 'utf8');                        // 184
  _.each(WebApp.clientProgram.manifest, function (resource) {                            // 185
    if (resource.where === 'client' || resource.where === 'internal') {                  // 186
      hash.update(resource.path);                                                        // 187
      hash.update(resource.hash);                                                        // 188
    }                                                                                    // 189
  });                                                                                    // 190
  return hash.digest('hex');                                                             // 191
};                                                                                       // 192
                                                                                         // 193
                                                                                         // 194
// We need to calculate the client hash after all packages have loaded                   // 195
// to give them a chance to populate __meteor_runtime_config__.                          // 196
//                                                                                       // 197
// Calculating the hash during startup means that packages can only                      // 198
// populate __meteor_runtime_config__ during load, not during startup.                   // 199
//                                                                                       // 200
// Calculating instead it at the beginning of main after all startup                     // 201
// hooks had run would allow packages to also populate                                   // 202
// __meteor_runtime_config__ during startup, but that's too late for                     // 203
// autoupdate because it needs to have the client hash at startup to                     // 204
// insert the auto update version itself into                                            // 205
// __meteor_runtime_config__ to get it to the client.                                    // 206
//                                                                                       // 207
// An alternative would be to give autoupdate a "post-start,                             // 208
// pre-listen" hook to allow it to insert the auto update version at                     // 209
// the right moment.                                                                     // 210
                                                                                         // 211
Meteor.startup(function () {                                                             // 212
  WebApp.clientHash = calculateClientHash();                                             // 213
});                                                                                      // 214
                                                                                         // 215
                                                                                         // 216
                                                                                         // 217
// When we have a request pending, we want the socket timeout to be long, to             // 218
// give ourselves a while to serve it, and to allow sockjs long polls to                 // 219
// complete.  On the other hand, we want to close idle sockets relatively                // 220
// quickly, so that we can shut down relatively promptly but cleanly, without            // 221
// cutting off anyone's response.                                                        // 222
WebApp._timeoutAdjustmentRequestCallback = function (req, res) {                         // 223
  // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);                     // 224
  req.setTimeout(LONG_SOCKET_TIMEOUT);                                                   // 225
  // Insert our new finish listener to run BEFORE the existing one which removes         // 226
  // the response from the socket.                                                       // 227
  var finishListeners = res.listeners('finish');                                         // 228
  // XXX Apparently in Node 0.12 this event is now called 'prefinish'.                   // 229
  // https://github.com/joyent/node/commit/7c9b6070                                      // 230
  res.removeAllListeners('finish');                                                      // 231
  res.on('finish', function () {                                                         // 232
    res.setTimeout(SHORT_SOCKET_TIMEOUT);                                                // 233
  });                                                                                    // 234
  _.each(finishListeners, function (l) { res.on('finish', l); });                        // 235
};                                                                                       // 236
                                                                                         // 237
var runWebAppServer = function () {                                                      // 238
  var shuttingDown = false;                                                              // 239
  // read the control for the client we'll be serving up                                 // 240
  var clientJsonPath = path.join(__meteor_bootstrap__.serverDir,                         // 241
                                 __meteor_bootstrap__.configJson.client);                // 242
  var clientDir = path.dirname(clientJsonPath);                                          // 243
  var clientJson = JSON.parse(fs.readFileSync(clientJsonPath, 'utf8'));                  // 244
                                                                                         // 245
  if (clientJson.format !== "browser-program-pre1")                                      // 246
    throw new Error("Unsupported format for client assets: " +                           // 247
                    JSON.stringify(clientJson.format));                                  // 248
                                                                                         // 249
  // webserver                                                                           // 250
  var app = connect();                                                                   // 251
                                                                                         // 252
  // Auto-compress any json, javascript, or text.                                        // 253
  app.use(connect.compress());                                                           // 254
                                                                                         // 255
  // Packages and apps can add handlers that run before any other Meteor                 // 256
  // handlers via WebApp.rawConnectHandlers.                                             // 257
  var rawConnectHandlers = connect();                                                    // 258
  app.use(rawConnectHandlers);                                                           // 259
                                                                                         // 260
  // Strip off the path prefix, if it exists.                                            // 261
  app.use(function (request, response, next) {                                           // 262
    var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;                     // 263
    var url = Npm.require('url').parse(request.url);                                     // 264
    var pathname = url.pathname;                                                         // 265
    // check if the path in the url starts with the path prefix (and the part            // 266
    // after the path prefix must start with a / if it exists.)                          // 267
    if (pathPrefix && pathname.substring(0, pathPrefix.length) === pathPrefix &&         // 268
       (pathname.length == pathPrefix.length                                             // 269
        || pathname.substring(pathPrefix.length, pathPrefix.length + 1) === "/")) {      // 270
      request.url = request.url.substring(pathPrefix.length);                            // 271
      next();                                                                            // 272
    } else if (pathname === "/favicon.ico" || pathname === "/robots.txt") {              // 273
      next();                                                                            // 274
    } else if (pathPrefix) {                                                             // 275
      response.writeHead(404);                                                           // 276
      response.write("Unknown path");                                                    // 277
      response.end();                                                                    // 278
    } else {                                                                             // 279
      next();                                                                            // 280
    }                                                                                    // 281
  });                                                                                    // 282
                                                                                         // 283
  // Parse the query string into res.query. Used by oauth_server, but it's               // 284
  // generally pretty handy..                                                            // 285
  app.use(connect.query());                                                              // 286
                                                                                         // 287
  var getItemPathname = function (itemUrl) {                                             // 288
    return decodeURIComponent(url.parse(itemUrl).pathname);                              // 289
  };                                                                                     // 290
                                                                                         // 291
  var staticFiles = {};                                                                  // 292
  _.each(clientJson.manifest, function (item) {                                          // 293
    if (item.url && item.where === "client") {                                           // 294
      staticFiles[getItemPathname(item.url)] = {                                         // 295
        path: item.path,                                                                 // 296
        cacheable: item.cacheable,                                                       // 297
        // Link from source to its map                                                   // 298
        sourceMapUrl: item.sourceMapUrl                                                  // 299
      };                                                                                 // 300
                                                                                         // 301
      if (item.sourceMap) {                                                              // 302
        // Serve the source map too, under the specified URL. We assume all              // 303
        // source maps are cacheable.                                                    // 304
        staticFiles[getItemPathname(item.sourceMapUrl)] = {                              // 305
          path: item.sourceMap,                                                          // 306
          cacheable: true                                                                // 307
        };                                                                               // 308
      }                                                                                  // 309
    }                                                                                    // 310
  });                                                                                    // 311
                                                                                         // 312
                                                                                         // 313
  // Serve static files from the manifest.                                               // 314
  // This is inspired by the 'static' middleware.                                        // 315
  app.use(function (req, res, next) {                                                    // 316
    if ('GET' != req.method && 'HEAD' != req.method) {                                   // 317
      next();                                                                            // 318
      return;                                                                            // 319
    }                                                                                    // 320
    var pathname = connect.utils.parseUrl(req).pathname;                                 // 321
                                                                                         // 322
    try {                                                                                // 323
      pathname = decodeURIComponent(pathname);                                           // 324
    } catch (e) {                                                                        // 325
      next();                                                                            // 326
      return;                                                                            // 327
    }                                                                                    // 328
                                                                                         // 329
    var serveStaticJs = function (s) {                                                   // 330
      res.writeHead(200, { 'Content-type': 'application/javascript' });                  // 331
      res.write(s);                                                                      // 332
      res.end();                                                                         // 333
    };                                                                                   // 334
                                                                                         // 335
    if (pathname === "/meteor_runtime_config.js" &&                                      // 336
        ! WebAppInternals.inlineScriptsAllowed()) {                                      // 337
      serveStaticJs("__meteor_runtime_config__ = " +                                     // 338
                    JSON.stringify(__meteor_runtime_config__) + ";");                    // 339
      return;                                                                            // 340
    } else if (pathname === "/meteor_reload_safetybelt.js" &&                            // 341
               ! WebAppInternals.inlineScriptsAllowed()) {                               // 342
      serveStaticJs(RELOAD_SAFETYBELT);                                                  // 343
      return;                                                                            // 344
    }                                                                                    // 345
                                                                                         // 346
    if (!_.has(staticFiles, pathname)) {                                                 // 347
      next();                                                                            // 348
      return;                                                                            // 349
    }                                                                                    // 350
                                                                                         // 351
    // We don't need to call pause because, unlike 'static', once we call into           // 352
    // 'send' and yield to the event loop, we never call another handler with            // 353
    // 'next'.                                                                           // 354
                                                                                         // 355
    var info = staticFiles[pathname];                                                    // 356
                                                                                         // 357
    // Cacheable files are files that should never change. Typically                     // 358
    // named by their hash (eg meteor bundled js and css files).                         // 359
    // We cache them ~forever (1yr).                                                     // 360
    //                                                                                   // 361
    // We cache non-cacheable files anyway. This isn't really correct, as users          // 362
    // can change the files and changes won't propagate immediately. However, if         // 363
    // we don't cache them, browsers will 'flicker' when rerendering                     // 364
    // images. Eventually we will probably want to rewrite URLs of static assets         // 365
    // to include a query parameter to bust caches. That way we can both get             // 366
    // good caching behavior and allow users to change assets without delay.             // 367
    // https://github.com/meteor/meteor/issues/773                                       // 368
    var maxAge = info.cacheable                                                          // 369
          ? 1000 * 60 * 60 * 24 * 365                                                    // 370
          : 1000 * 60 * 60 * 24;                                                         // 371
                                                                                         // 372
    // Set the X-SourceMap header, which current Chrome understands.                     // 373
    // (The files also contain '//#' comments which FF 24 understands and                // 374
    // Chrome doesn't understand yet.)                                                   // 375
    //                                                                                   // 376
    // Eventually we should set the SourceMap header but the current version of          // 377
    // Chrome and no version of FF supports it.                                          // 378
    //                                                                                   // 379
    // To figure out if your version of Chrome should support the SourceMap              // 380
    // header,                                                                           // 381
    //   - go to chrome://version. Let's say the Chrome version is                       // 382
    //      28.0.1500.71 and the Blink version is 537.36 (@153022)                       // 383
    //   - go to http://src.chromium.org/viewvc/blink/branches/chromium/1500/Source/core/inspector/InspectorPageAgent.cpp?view=log
    //     where the "1500" is the third part of your Chrome version                     // 385
    //   - find the first revision that is no greater than the "153022"                  // 386
    //     number.  That's probably the first one and it probably has                    // 387
    //     a message of the form "Branch 1500 - blink@r149738"                           // 388
    //   - If *that* revision number (149738) is at least 151755,                        // 389
    //     then Chrome should support SourceMap (not just X-SourceMap)                   // 390
    // (The change is https://codereview.chromium.org/15832007)                          // 391
    //                                                                                   // 392
    // You also need to enable source maps in Chrome: open dev tools, click              // 393
    // the gear in the bottom right corner, and select "enable source maps".             // 394
    //                                                                                   // 395
    // Firefox 23+ supports source maps but doesn't support either header yet,           // 396
    // so we include the '//#' comment for it:                                           // 397
    //   https://bugzilla.mozilla.org/show_bug.cgi?id=765993                             // 398
    // In FF 23 you need to turn on `devtools.debugger.source-maps-enabled`              // 399
    // in `about:config` (it is on by default in FF 24).                                 // 400
    if (info.sourceMapUrl)                                                               // 401
      res.setHeader('X-SourceMap', info.sourceMapUrl);                                   // 402
    send(req, path.join(clientDir, info.path))                                           // 403
      .maxage(maxAge)                                                                    // 404
      .hidden(true)  // if we specified a dotfile in the manifest, serve it              // 405
      .on('error', function (err) {                                                      // 406
        Log.error("Error serving static file " + err);                                   // 407
        res.writeHead(500);                                                              // 408
        res.end();                                                                       // 409
      })                                                                                 // 410
      .on('directory', function () {                                                     // 411
        Log.error("Unexpected directory " + info.path);                                  // 412
        res.writeHead(500);                                                              // 413
        res.end();                                                                       // 414
      })                                                                                 // 415
      .pipe(res);                                                                        // 416
  });                                                                                    // 417
                                                                                         // 418
  // Packages and apps can add handlers to this via WebApp.connectHandlers.              // 419
  // They are inserted before our default handler.                                       // 420
  var packageAndAppHandlers = connect();                                                 // 421
  app.use(packageAndAppHandlers);                                                        // 422
                                                                                         // 423
  var suppressConnectErrors = false;                                                     // 424
  // connect knows it is an error handler because it has 4 arguments instead of          // 425
  // 3. go figure.  (It is not smart enough to find such a thing if it's hidden          // 426
  // inside packageAndAppHandlers.)                                                      // 427
  app.use(function (err, req, res, next) {                                               // 428
    if (!err || !suppressConnectErrors || !req.headers['x-suppress-error']) {            // 429
      next(err);                                                                         // 430
      return;                                                                            // 431
    }                                                                                    // 432
    res.writeHead(err.status, { 'Content-Type': 'text/plain' });                         // 433
    res.end("An error message");                                                         // 434
  });                                                                                    // 435
                                                                                         // 436
  // Will be updated by main before we listen.                                           // 437
  var boilerplateTemplate = null;                                                        // 438
  var boilerplateBaseData = null;                                                        // 439
  var boilerplateByAttributes = {};                                                      // 440
  app.use(function (req, res, next) {                                                    // 441
    if (! appUrl(req.url))                                                               // 442
      return next();                                                                     // 443
                                                                                         // 444
    if (!boilerplateTemplate)                                                            // 445
      throw new Error("boilerplateTemplate should be set before listening!");            // 446
    if (!boilerplateBaseData)                                                            // 447
      throw new Error("boilerplateBaseData should be set before listening!");            // 448
                                                                                         // 449
                                                                                         // 450
    var headers = {                                                                      // 451
      'Content-Type':  'text/html; charset=utf-8'                                        // 452
    };                                                                                   // 453
    if (shuttingDown)                                                                    // 454
      headers['Connection'] = 'Close';                                                   // 455
                                                                                         // 456
    var request = WebApp.categorizeRequest(req);                                         // 457
                                                                                         // 458
    if (request.url.query && request.url.query['meteor_css_resource']) {                 // 459
      // In this case, we're requesting a CSS resource in the meteor-specific            // 460
      // way, but we don't have it.  Serve a static css file that indicates that         // 461
      // we didn't have it, so we can detect that and refresh.                           // 462
      headers['Content-Type'] = 'text/css; charset=utf-8';                               // 463
      res.writeHead(200, headers);                                                       // 464
      res.write(".meteor-css-not-found-error { width: 0px;}");                           // 465
      res.end();                                                                         // 466
      return undefined;                                                                  // 467
    }                                                                                    // 468
                                                                                         // 469
    var htmlAttributes = getHtmlAttributes(request);                                     // 470
                                                                                         // 471
    // The only thing that changes from request to request (for now) are the             // 472
    // HTML attributes (used by, eg, appcache), so we can memoize based on that.         // 473
    var attributeKey = JSON.stringify(htmlAttributes);                                   // 474
    if (!_.has(boilerplateByAttributes, attributeKey)) {                                 // 475
      try {                                                                              // 476
        var boilerplateData = _.extend({htmlAttributes: htmlAttributes},                 // 477
                                       boilerplateBaseData);                             // 478
        var boilerplateInstance = boilerplateTemplate.extend({                           // 479
          data: boilerplateData                                                          // 480
        });                                                                              // 481
        var boilerplateHtmlJs = boilerplateInstance.render();                            // 482
        boilerplateByAttributes[attributeKey] = "<!DOCTYPE html>\n" +                    // 483
              HTML.toHTML(boilerplateHtmlJs, boilerplateInstance);                       // 484
      } catch (e) {                                                                      // 485
        Log.error("Error running template: " + e);                                       // 486
        res.writeHead(500, headers);                                                     // 487
        res.end();                                                                       // 488
        return undefined;                                                                // 489
      }                                                                                  // 490
    }                                                                                    // 491
                                                                                         // 492
    res.writeHead(200, headers);                                                         // 493
    res.write(boilerplateByAttributes[attributeKey]);                                    // 494
    res.end();                                                                           // 495
    return undefined;                                                                    // 496
  });                                                                                    // 497
                                                                                         // 498
  // Return 404 by default, if no other handlers serve this URL.                         // 499
  app.use(function (req, res) {                                                          // 500
    res.writeHead(404);                                                                  // 501
    res.end();                                                                           // 502
  });                                                                                    // 503
                                                                                         // 504
                                                                                         // 505
  var httpServer = http.createServer(app);                                               // 506
  var onListeningCallbacks = [];                                                         // 507
                                                                                         // 508
  // After 5 seconds w/o data on a socket, kill it.  On the other hand, if               // 509
  // there's an outstanding request, give it a higher timeout instead (to avoid          // 510
  // killing long-polling requests)                                                      // 511
  httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);                                           // 512
                                                                                         // 513
  // Do this here, and then also in livedata/stream_server.js, because                   // 514
  // stream_server.js kills all the current request handlers when installing its         // 515
  // own.                                                                                // 516
  httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);                    // 517
                                                                                         // 518
                                                                                         // 519
  // For now, handle SIGHUP here.  Later, this should be in some centralized             // 520
  // Meteor shutdown code.                                                               // 521
  process.on('SIGHUP', Meteor.bindEnvironment(function () {                              // 522
    shuttingDown = true;                                                                 // 523
    // tell others with websockets open that we plan to close this.                      // 524
    // XXX: Eventually, this should be done with a standard meteor shut-down             // 525
    // logic path.                                                                       // 526
    httpServer.emit('meteor-closing');                                                   // 527
                                                                                         // 528
    httpServer.close(Meteor.bindEnvironment(function () {                                // 529
      if (proxy) {                                                                       // 530
        try {                                                                            // 531
          proxy.call('removeBindingsForJob', process.env.GALAXY_JOB);                    // 532
        } catch (e) {                                                                    // 533
          Log.error("Error removing bindings: " + e.message);                            // 534
          process.exit(1);                                                               // 535
        }                                                                                // 536
      }                                                                                  // 537
      process.exit(0);                                                                   // 538
                                                                                         // 539
    }, "On http server close failed"));                                                  // 540
                                                                                         // 541
    // Ideally we will close before this hits.                                           // 542
    Meteor.setTimeout(function () {                                                      // 543
      Log.warn("Closed by SIGHUP but one or more HTTP requests may not have finished."); // 544
      process.exit(1);                                                                   // 545
    }, 5000);                                                                            // 546
                                                                                         // 547
  }, function (err) {                                                                    // 548
    console.log(err);                                                                    // 549
    process.exit(1);                                                                     // 550
  }));                                                                                   // 551
                                                                                         // 552
  // start up app                                                                        // 553
  _.extend(WebApp, {                                                                     // 554
    connectHandlers: packageAndAppHandlers,                                              // 555
    rawConnectHandlers: rawConnectHandlers,                                              // 556
    httpServer: httpServer,                                                              // 557
    // metadata about the client program that we serve                                   // 558
    clientProgram: {                                                                     // 559
      manifest: clientJson.manifest                                                      // 560
      // XXX do we need a "root: clientDir" field here? it used to be here but           // 561
      // was unused.                                                                     // 562
    },                                                                                   // 563
    // For testing.                                                                      // 564
    suppressConnectErrors: function () {                                                 // 565
      suppressConnectErrors = true;                                                      // 566
    },                                                                                   // 567
    onListening: function (f) {                                                          // 568
      if (onListeningCallbacks)                                                          // 569
        onListeningCallbacks.push(f);                                                    // 570
      else                                                                               // 571
        f();                                                                             // 572
    },                                                                                   // 573
    // Hack: allow http tests to call connect.basicAuth without making them              // 574
    // Npm.depends on another copy of connect. (That would be fine if we could           // 575
    // have test-only NPM dependencies but is overkill here.)                            // 576
    __basicAuth__: connect.basicAuth                                                     // 577
  });                                                                                    // 578
                                                                                         // 579
  // Let the rest of the packages (and Meteor.startup hooks) insert connect              // 580
  // middlewares and update __meteor_runtime_config__, then keep going to set up         // 581
  // actually serving HTML.                                                              // 582
  main = function (argv) {                                                               // 583
    // main happens post startup hooks, so we don't need a Meteor.startup() to           // 584
    // ensure this happens after the galaxy package is loaded.                           // 585
    var AppConfig = Package["application-configuration"].AppConfig;                      // 586
    // We used to use the optimist npm package to parse argv here, but it's              // 587
    // overkill (and no longer in the dev bundle). Just assume any instance of           // 588
    // '--keepalive' is a use of the option.                                             // 589
    var expectKeepalives = _.contains(argv, '--keepalive');                              // 590
                                                                                         // 591
    boilerplateBaseData = {                                                              // 592
      css: [],                                                                           // 593
      js: [],                                                                            // 594
      head: '',                                                                          // 595
      body: '',                                                                          // 596
      inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),                      // 597
      meteorRuntimeConfig: JSON.stringify(__meteor_runtime_config__),                    // 598
      reloadSafetyBelt: RELOAD_SAFETYBELT,                                               // 599
      rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',           // 600
      bundledJsCssPrefix: bundledJsCssPrefix ||                                          // 601
        __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || ''                             // 602
    };                                                                                   // 603
                                                                                         // 604
    _.each(WebApp.clientProgram.manifest, function (item) {                              // 605
      if (item.type === 'css' && item.where === 'client') {                              // 606
        boilerplateBaseData.css.push({url: item.url});                                   // 607
      }                                                                                  // 608
      if (item.type === 'js' && item.where === 'client') {                               // 609
        boilerplateBaseData.js.push({url: item.url});                                    // 610
      }                                                                                  // 611
      if (item.type === 'head') {                                                        // 612
        boilerplateBaseData.head = fs.readFileSync(                                      // 613
          path.join(clientDir, item.path), 'utf8');                                      // 614
      }                                                                                  // 615
      if (item.type === 'body') {                                                        // 616
        boilerplateBaseData.body = fs.readFileSync(                                      // 617
          path.join(clientDir, item.path), 'utf8');                                      // 618
      }                                                                                  // 619
    });                                                                                  // 620
                                                                                         // 621
    var boilerplateTemplateSource = Assets.getText("boilerplate.html");                  // 622
    var boilerplateRenderCode = Spacebars.compile(                                       // 623
      boilerplateTemplateSource, { isBody: true });                                      // 624
                                                                                         // 625
    // Note that we are actually depending on eval's local environment capture           // 626
    // so that UI and HTML are visible to the eval'd code.                               // 627
    var boilerplateRender = eval(boilerplateRenderCode);                                 // 628
                                                                                         // 629
    boilerplateTemplate = UI.Component.extend({                                          // 630
      kind: "MainPage",                                                                  // 631
      render: boilerplateRender                                                          // 632
    });                                                                                  // 633
                                                                                         // 634
    // only start listening after all the startup code has run.                          // 635
    var localPort = parseInt(process.env.PORT) || 0;                                     // 636
    var host = process.env.BIND_IP;                                                      // 637
    var localIp = host || '0.0.0.0';                                                     // 638
    httpServer.listen(localPort, localIp, Meteor.bindEnvironment(function() {            // 639
      if (expectKeepalives)                                                              // 640
        console.log("LISTENING"); // must match run-app.js                               // 641
      var proxyBinding;                                                                  // 642
                                                                                         // 643
      AppConfig.configurePackage('webapp', function (configuration) {                    // 644
        if (proxyBinding)                                                                // 645
          proxyBinding.stop();                                                           // 646
        if (configuration && configuration.proxy) {                                      // 647
          // TODO: We got rid of the place where this checks the app's                   // 648
          // configuration, because this wants to be configured for some things          // 649
          // on a per-job basis.  Discuss w/ teammates.                                  // 650
          proxyBinding = AppConfig.configureService(                                     // 651
            "proxy",                                                                     // 652
            "pre0",                                                                      // 653
            function (proxyService) {                                                    // 654
              if (proxyService && ! _.isEmpty(proxyService)) {                           // 655
                var proxyConf;                                                           // 656
                // XXX Figure out a per-job way to specify bind location                 // 657
                // (besides hardcoding the location for ADMIN_APP jobs).                 // 658
                if (process.env.ADMIN_APP) {                                             // 659
                  var bindPathPrefix = "";                                               // 660
                  if (process.env.GALAXY_APP !== "panel") {                              // 661
                    bindPathPrefix = "/" + bindPathPrefix +                              // 662
                      encodeURIComponent(                                                // 663
                        process.env.GALAXY_APP                                           // 664
                      ).replace(/\./g, '_');                                             // 665
                  }                                                                      // 666
                  proxyConf = {                                                          // 667
                    bindHost: process.env.GALAXY_NAME,                                   // 668
                    bindPathPrefix: bindPathPrefix,                                      // 669
                    requiresAuth: true                                                   // 670
                  };                                                                     // 671
                } else {                                                                 // 672
                  proxyConf = configuration.proxy;                                       // 673
                }                                                                        // 674
                Log("Attempting to bind to proxy at " +                                  // 675
                    proxyService);                                                       // 676
                WebAppInternals.bindToProxy(_.extend({                                   // 677
                  proxyEndpoint: proxyService                                            // 678
                }, proxyConf));                                                          // 679
              }                                                                          // 680
            }                                                                            // 681
          );                                                                             // 682
        }                                                                                // 683
      });                                                                                // 684
                                                                                         // 685
      var callbacks = onListeningCallbacks;                                              // 686
      onListeningCallbacks = null;                                                       // 687
      _.each(callbacks, function (x) { x(); });                                          // 688
                                                                                         // 689
    }, function (e) {                                                                    // 690
      console.error("Error listening:", e);                                              // 691
      console.error(e && e.stack);                                                       // 692
    }));                                                                                 // 693
                                                                                         // 694
    if (expectKeepalives)                                                                // 695
      initKeepalive();                                                                   // 696
    return 'DAEMON';                                                                     // 697
  };                                                                                     // 698
};                                                                                       // 699
                                                                                         // 700
                                                                                         // 701
var proxy;                                                                               // 702
WebAppInternals.bindToProxy = function (proxyConfig) {                                   // 703
  var securePort = proxyConfig.securePort || 4433;                                       // 704
  var insecurePort = proxyConfig.insecurePort || 8080;                                   // 705
  var bindPathPrefix = proxyConfig.bindPathPrefix || "";                                 // 706
  // XXX also support galaxy-based lookup                                                // 707
  if (!proxyConfig.proxyEndpoint)                                                        // 708
    throw new Error("missing proxyEndpoint");                                            // 709
  if (!proxyConfig.bindHost)                                                             // 710
    throw new Error("missing bindHost");                                                 // 711
  if (!process.env.GALAXY_JOB)                                                           // 712
    throw new Error("missing $GALAXY_JOB");                                              // 713
  if (!process.env.GALAXY_APP)                                                           // 714
    throw new Error("missing $GALAXY_APP");                                              // 715
  if (!process.env.LAST_START)                                                           // 716
    throw new Error("missing $LAST_START");                                              // 717
                                                                                         // 718
  // XXX rename pid argument to bindTo.                                                  // 719
  // XXX factor out into a 'getPid' function in a 'galaxy' package?                      // 720
  var pid = {                                                                            // 721
    job: process.env.GALAXY_JOB,                                                         // 722
    lastStarted: +(process.env.LAST_START),                                              // 723
    app: process.env.GALAXY_APP                                                          // 724
  };                                                                                     // 725
  var myHost = os.hostname();                                                            // 726
                                                                                         // 727
  WebAppInternals.usingDdpProxy = true;                                                  // 728
                                                                                         // 729
  // This is run after packages are loaded (in main) so we can use                       // 730
  // Follower.connect.                                                                   // 731
  if (proxy) {                                                                           // 732
    // XXX the concept here is that our configuration has changed and                    // 733
    // we have connected to an entirely new follower set, which does                     // 734
    // not have the state that we set up on the follower set that we                     // 735
    // were previously connected to, and so we need to recreate all of                   // 736
    // our bindings -- analogous to getting a SIGHUP and rereading                       // 737
    // your configuration file. so probably this should actually tear                    // 738
    // down the connection and make a whole new one, rather than                         // 739
    // hot-reconnecting to a different URL.                                              // 740
    proxy.reconnect({                                                                    // 741
      url: proxyConfig.proxyEndpoint                                                     // 742
    });                                                                                  // 743
  } else {                                                                               // 744
    proxy = Package["follower-livedata"].Follower.connect(                               // 745
      proxyConfig.proxyEndpoint, {                                                       // 746
        group: "proxy"                                                                   // 747
      }                                                                                  // 748
    );                                                                                   // 749
  }                                                                                      // 750
                                                                                         // 751
  var route = process.env.ROUTE;                                                         // 752
  var ourHost = route.split(":")[0];                                                     // 753
  var ourPort = +route.split(":")[1];                                                    // 754
                                                                                         // 755
  var outstanding = 0;                                                                   // 756
  var startedAll = false;                                                                // 757
  var checkComplete = function () {                                                      // 758
    if (startedAll && ! outstanding)                                                     // 759
      Log("Bound to proxy.");                                                            // 760
  };                                                                                     // 761
  var makeCallback = function () {                                                       // 762
    outstanding++;                                                                       // 763
    return function (err) {                                                              // 764
      if (err)                                                                           // 765
        throw err;                                                                       // 766
      outstanding--;                                                                     // 767
      checkComplete();                                                                   // 768
    };                                                                                   // 769
  };                                                                                     // 770
                                                                                         // 771
  // for now, have our (temporary) requiresAuth flag apply to all                        // 772
  // routes created by this process.                                                     // 773
  var requiresDdpAuth = !! proxyConfig.requiresAuth;                                     // 774
  var requiresHttpAuth = (!! proxyConfig.requiresAuth) &&                                // 775
        (pid.app !== "panel" && pid.app !== "auth");                                     // 776
                                                                                         // 777
  // XXX a current limitation is that we treat securePort and                            // 778
  // insecurePort as a global configuration parameter -- we assume                       // 779
  // that if the proxy wants us to ask for 8080 to get port 80 traffic                   // 780
  // on our default hostname, that's the same port that we would use                     // 781
  // to get traffic on some other hostname that our proxy listens                        // 782
  // for. Likewise, we assume that if the proxy can receive secure                       // 783
  // traffic for our domain, it can assume secure traffic for any                        // 784
  // domain! Hopefully this will get cleaned up before too long by                       // 785
  // pushing that logic into the proxy service, so we can just ask for                   // 786
  // port 80.                                                                            // 787
                                                                                         // 788
  // XXX BUG: if our configuration changes, and bindPathPrefix                           // 789
  // changes, it appears that we will not remove the routes derived                      // 790
  // from the old bindPathPrefix from the proxy (until the process                       // 791
  // exits). It is not actually normal for bindPathPrefix to change,                     // 792
  // certainly not without a process restart for other reasons, but                      // 793
  // it'd be nice to fix.                                                                // 794
                                                                                         // 795
  _.each(routes, function (route) {                                                      // 796
    var parsedUrl = url.parse(route.url, /* parseQueryString */ false,                   // 797
                              /* slashesDenoteHost aka workRight */ true);               // 798
    if (parsedUrl.protocol || parsedUrl.port || parsedUrl.search)                        // 799
      throw new Error("Bad url");                                                        // 800
    parsedUrl.host = null;                                                               // 801
    parsedUrl.path = null;                                                               // 802
    if (! parsedUrl.hostname) {                                                          // 803
      parsedUrl.hostname = proxyConfig.bindHost;                                         // 804
      if (! parsedUrl.pathname)                                                          // 805
        parsedUrl.pathname = "";                                                         // 806
      if (! parsedUrl.pathname.indexOf("/") !== 0) {                                     // 807
        // Relative path                                                                 // 808
        parsedUrl.pathname = bindPathPrefix + parsedUrl.pathname;                        // 809
      }                                                                                  // 810
    }                                                                                    // 811
    var version = "";                                                                    // 812
                                                                                         // 813
    var AppConfig = Package["application-configuration"].AppConfig;                      // 814
    version = AppConfig.getStarForThisJob() || "";                                       // 815
                                                                                         // 816
                                                                                         // 817
    var parsedDdpUrl = _.clone(parsedUrl);                                               // 818
    parsedDdpUrl.protocol = "ddp";                                                       // 819
    // Node has a hardcoded list of protocols that get '://' instead                     // 820
    // of ':'. ddp needs to be added to that whitelist. Until then, we                   // 821
    // can set the undocumented attribute 'slashes' to get the right                     // 822
    // behavior. It's not clear whether than is by design or accident.                   // 823
    parsedDdpUrl.slashes = true;                                                         // 824
    parsedDdpUrl.port = '' + securePort;                                                 // 825
    var ddpUrl = url.format(parsedDdpUrl);                                               // 826
                                                                                         // 827
    var proxyToHost, proxyToPort, proxyToPathPrefix;                                     // 828
    if (! _.has(route, 'forwardTo')) {                                                   // 829
      proxyToHost = ourHost;                                                             // 830
      proxyToPort = ourPort;                                                             // 831
      proxyToPathPrefix = parsedUrl.pathname;                                            // 832
    } else {                                                                             // 833
      var parsedFwdUrl = url.parse(route.forwardTo, false, true);                        // 834
      if (! parsedFwdUrl.hostname || parsedFwdUrl.protocol)                              // 835
        throw new Error("Bad forward url");                                              // 836
      proxyToHost = parsedFwdUrl.hostname;                                               // 837
      proxyToPort = parseInt(parsedFwdUrl.port || "80");                                 // 838
      proxyToPathPrefix = parsedFwdUrl.pathname || "";                                   // 839
    }                                                                                    // 840
                                                                                         // 841
    if (route.ddp) {                                                                     // 842
      proxy.call('bindDdp', {                                                            // 843
        pid: pid,                                                                        // 844
        bindTo: {                                                                        // 845
          ddpUrl: ddpUrl,                                                                // 846
          insecurePort: insecurePort                                                     // 847
        },                                                                               // 848
        proxyTo: {                                                                       // 849
          tags: [version],                                                               // 850
          host: proxyToHost,                                                             // 851
          port: proxyToPort,                                                             // 852
          pathPrefix: proxyToPathPrefix + '/websocket'                                   // 853
        },                                                                               // 854
        requiresAuth: requiresDdpAuth                                                    // 855
      }, makeCallback());                                                                // 856
    }                                                                                    // 857
                                                                                         // 858
    if (route.http) {                                                                    // 859
      proxy.call('bindHttp', {                                                           // 860
        pid: pid,                                                                        // 861
        bindTo: {                                                                        // 862
          host: parsedUrl.hostname,                                                      // 863
          port: insecurePort,                                                            // 864
          pathPrefix: parsedUrl.pathname                                                 // 865
        },                                                                               // 866
        proxyTo: {                                                                       // 867
          tags: [version],                                                               // 868
          host: proxyToHost,                                                             // 869
          port: proxyToPort,                                                             // 870
          pathPrefix: proxyToPathPrefix                                                  // 871
        },                                                                               // 872
        requiresAuth: requiresHttpAuth                                                   // 873
      }, makeCallback());                                                                // 874
                                                                                         // 875
      // Only make the secure binding if we've been told that the                        // 876
      // proxy knows how terminate secure connections for us (has an                     // 877
      // appropriate cert, can bind the necessary port..)                                // 878
      if (proxyConfig.securePort !== null) {                                             // 879
        proxy.call('bindHttp', {                                                         // 880
          pid: pid,                                                                      // 881
          bindTo: {                                                                      // 882
            host: parsedUrl.hostname,                                                    // 883
            port: securePort,                                                            // 884
            pathPrefix: parsedUrl.pathname,                                              // 885
            ssl: true                                                                    // 886
          },                                                                             // 887
          proxyTo: {                                                                     // 888
            tags: [version],                                                             // 889
            host: proxyToHost,                                                           // 890
            port: proxyToPort,                                                           // 891
            pathPrefix: proxyToPathPrefix                                                // 892
          },                                                                             // 893
          requiresAuth: requiresHttpAuth                                                 // 894
        }, makeCallback());                                                              // 895
      }                                                                                  // 896
    }                                                                                    // 897
  });                                                                                    // 898
                                                                                         // 899
  startedAll = true;                                                                     // 900
  checkComplete();                                                                       // 901
};                                                                                       // 902
                                                                                         // 903
// (Internal, unsupported interface -- subject to change)                                // 904
//                                                                                       // 905
// Listen for HTTP and/or DDP traffic and route it somewhere. Only                       // 906
// takes effect when using a proxy service.                                              // 907
//                                                                                       // 908
// 'url' is the traffic that we want to route, interpreted relative to                   // 909
// the default URL where this app has been told to serve itself. It                      // 910
// may not have a scheme or port, but it may have a host and a path,                     // 911
// and if no host is provided the path need not be absolute. The                         // 912
// following cases are possible:                                                         // 913
//                                                                                       // 914
//   //somehost.com                                                                      // 915
//     All incoming traffic for 'somehost.com'                                           // 916
//   //somehost.com/foo/bar                                                              // 917
//     All incoming traffic for 'somehost.com', but only when                            // 918
//     the first two path components are 'foo' and 'bar'.                                // 919
//   /foo/bar                                                                            // 920
//     Incoming traffic on our default host, but only when the                           // 921
//     first two path components are 'foo' and 'bar'.                                    // 922
//   foo/bar                                                                             // 923
//     Incoming traffic on our default host, but only when the path                      // 924
//     starts with our default path prefix, followed by 'foo' and                        // 925
//     'bar'.                                                                            // 926
//                                                                                       // 927
// (Yes, these scheme-less URLs that start with '//' are legal URLs.)                    // 928
//                                                                                       // 929
// You can select either DDP traffic, HTTP traffic, or both. Both                        // 930
// secure and insecure traffic will be gathered (assuming the proxy                      // 931
// service is capable, eg, has appropriate certs and port mappings).                     // 932
//                                                                                       // 933
// With no 'forwardTo' option, the traffic is received by this process                   // 934
// for service by the hooks in this 'webapp' package. The original URL                   // 935
// is preserved (that is, if you bind "/a", and a user visits "/a/b",                    // 936
// the app receives a request with a path of "/a/b", not a path of                       // 937
// "/b").                                                                                // 938
//                                                                                       // 939
// With 'forwardTo', the process is instead sent to some other remote                    // 940
// host. The URL is adjusted by stripping the path components in 'url'                   // 941
// and putting the path components in the 'forwardTo' URL in their                       // 942
// place. For example, if you forward "//somehost/a" to                                  // 943
// "//otherhost/x", and the user types "//somehost/a/b" into their                       // 944
// browser, then otherhost will receive a request with a Host header                     // 945
// of "somehost" and a path of "/x/b".                                                   // 946
//                                                                                       // 947
// The routing continues until this process exits. For now, all of the                   // 948
// routes must be set up ahead of time, before the initial                               // 949
// registration with the proxy. Calling addRoute from the top level of                   // 950
// your JS should do the trick.                                                          // 951
//                                                                                       // 952
// When multiple routes are present that match a given request, the                      // 953
// most specific route wins. When routes with equal specificity are                      // 954
// present, the proxy service will distribute the traffic between                        // 955
// them.                                                                                 // 956
//                                                                                       // 957
// options may be:                                                                       // 958
// - ddp: if true, the default, include DDP traffic. This includes                       // 959
//   both secure and insecure traffic, and both websocket and sockjs                     // 960
//   transports.                                                                         // 961
// - http: if true, the default, include HTTP/HTTPS traffic.                             // 962
// - forwardTo: if provided, should be a URL with a host, optional                       // 963
//   path and port, and no scheme (the scheme will be derived from the                   // 964
//   traffic type; for now it will always be a http or ws connection,                    // 965
//   never https or wss, but we could add a forwardSecure flag to                        // 966
//   re-encrypt).                                                                        // 967
var routes = [];                                                                         // 968
WebAppInternals.addRoute = function (url, options) {                                     // 969
  options = _.extend({                                                                   // 970
    ddp: true,                                                                           // 971
    http: true                                                                           // 972
  }, options || {});                                                                     // 973
                                                                                         // 974
  if (proxy)                                                                             // 975
    // In the future, lift this restriction                                              // 976
    throw new Error("Too late to add routes");                                           // 977
                                                                                         // 978
  routes.push(_.extend({ url: url }, options));                                          // 979
};                                                                                       // 980
                                                                                         // 981
// Receive traffic on our default URL.                                                   // 982
WebAppInternals.addRoute("");                                                            // 983
                                                                                         // 984
runWebAppServer();                                                                       // 985
                                                                                         // 986
                                                                                         // 987
var inlineScriptsAllowed = true;                                                         // 988
                                                                                         // 989
WebAppInternals.inlineScriptsAllowed = function () {                                     // 990
  return inlineScriptsAllowed;                                                           // 991
};                                                                                       // 992
                                                                                         // 993
WebAppInternals.setInlineScriptsAllowed = function (value) {                             // 994
  inlineScriptsAllowed = value;                                                          // 995
};                                                                                       // 996
                                                                                         // 997
WebAppInternals.setBundledJsCssPrefix = function (prefix) {                              // 998
  bundledJsCssPrefix = prefix;                                                           // 999
};                                                                                       // 1000
                                                                                         // 1001
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.webapp = {
  WebApp: WebApp,
  main: main,
  WebAppInternals: WebAppInternals
};

})();
