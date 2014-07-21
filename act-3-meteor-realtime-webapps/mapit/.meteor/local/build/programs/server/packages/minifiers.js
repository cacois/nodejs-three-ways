(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;

/* Package-scope variables */
var CssTools, UglifyJSMinify, MinifyAst;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minifiers/minification.js                                                                                //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
                                                                                                                     // 1
// Stringifier based on css-stringify                                                                                // 2
var emit = function (str) {                                                                                          // 3
  return str.toString();                                                                                             // 4
};                                                                                                                   // 5
                                                                                                                     // 6
var visit = function (node, last) {                                                                                  // 7
  return traverse[node.type](node, last);                                                                            // 8
};                                                                                                                   // 9
                                                                                                                     // 10
var mapVisit = function (nodes) {                                                                                    // 11
  var buf = "";                                                                                                      // 12
                                                                                                                     // 13
  for (var i = 0, length = nodes.length; i < length; i++) {                                                          // 14
    buf += visit(nodes[i], i === length - 1);                                                                        // 15
  }                                                                                                                  // 16
                                                                                                                     // 17
  return buf;                                                                                                        // 18
};                                                                                                                   // 19
                                                                                                                     // 20
MinifyAst = function(node) {                                                                                         // 21
  return node.stylesheet                                                                                             // 22
    .rules.map(function (rule) { return visit(rule); })                                                              // 23
    .join('');                                                                                                       // 24
};                                                                                                                   // 25
                                                                                                                     // 26
var traverse = {};                                                                                                   // 27
                                                                                                                     // 28
traverse.comment = function(node) {                                                                                  // 29
  return emit('', node.position);                                                                                    // 30
};                                                                                                                   // 31
                                                                                                                     // 32
traverse.import = function(node) {                                                                                   // 33
  return emit('@import ' + node.import + ';', node.position);                                                        // 34
};                                                                                                                   // 35
                                                                                                                     // 36
traverse.media = function(node) {                                                                                    // 37
  return emit('@media ' + node.media, node.position, true)                                                           // 38
    + emit('{')                                                                                                      // 39
    + mapVisit(node.rules)                                                                                           // 40
    + emit('}');                                                                                                     // 41
};                                                                                                                   // 42
                                                                                                                     // 43
traverse.document = function(node) {                                                                                 // 44
  var doc = '@' + (node.vendor || '') + 'document ' + node.document;                                                 // 45
                                                                                                                     // 46
  return emit(doc, node.position, true)                                                                              // 47
    + emit('{')                                                                                                      // 48
    + mapVisit(node.rules)                                                                                           // 49
    + emit('}');                                                                                                     // 50
};                                                                                                                   // 51
                                                                                                                     // 52
traverse.charset = function(node) {                                                                                  // 53
  return emit('@charset ' + node.charset + ';', node.position);                                                      // 54
};                                                                                                                   // 55
                                                                                                                     // 56
traverse.namespace = function(node) {                                                                                // 57
  return emit('@namespace ' + node.namespace + ';', node.position);                                                  // 58
};                                                                                                                   // 59
                                                                                                                     // 60
traverse.supports = function(node){                                                                                  // 61
  return emit('@supports ' + node.supports, node.position, true)                                                     // 62
    + emit('{')                                                                                                      // 63
    + mapVisit(node.rules)                                                                                           // 64
    + emit('}');                                                                                                     // 65
};                                                                                                                   // 66
                                                                                                                     // 67
traverse.keyframes = function(node) {                                                                                // 68
  return emit('@'                                                                                                    // 69
    + (node.vendor || '')                                                                                            // 70
    + 'keyframes '                                                                                                   // 71
    + node.name, node.position, true)                                                                                // 72
    + emit('{')                                                                                                      // 73
    + mapVisit(node.keyframes)                                                                                       // 74
    + emit('}');                                                                                                     // 75
};                                                                                                                   // 76
                                                                                                                     // 77
traverse.keyframe = function(node) {                                                                                 // 78
  var decls = node.declarations;                                                                                     // 79
                                                                                                                     // 80
  return emit(node.values.join(','), node.position, true)                                                            // 81
    + emit('{')                                                                                                      // 82
    + mapVisit(decls)                                                                                                // 83
    + emit('}');                                                                                                     // 84
};                                                                                                                   // 85
                                                                                                                     // 86
traverse.page = function(node) {                                                                                     // 87
  var sel = node.selectors.length                                                                                    // 88
    ? node.selectors.join(', ')                                                                                      // 89
    : '';                                                                                                            // 90
                                                                                                                     // 91
  return emit('@page ' + sel, node.position, true)                                                                   // 92
    + emit('{')                                                                                                      // 93
    + mapVisit(node.declarations)                                                                                    // 94
    + emit('}');                                                                                                     // 95
};                                                                                                                   // 96
                                                                                                                     // 97
traverse['font-face'] = function(node){                                                                              // 98
  return emit('@font-face', node.position, true)                                                                     // 99
    + emit('{')                                                                                                      // 100
    + mapVisit(node.declarations)                                                                                    // 101
    + emit('}');                                                                                                     // 102
};                                                                                                                   // 103
                                                                                                                     // 104
traverse.rule = function(node) {                                                                                     // 105
  var decls = node.declarations;                                                                                     // 106
  if (!decls.length) return '';                                                                                      // 107
                                                                                                                     // 108
  var selectors = node.selectors.map(function (selector) {                                                           // 109
    // removes universal selectors like *.class => .class                                                            // 110
    // removes optional whitespace around '>' and '+'                                                                // 111
    return selector.replace(/\*\./, '.')                                                                             // 112
                   .replace(/\s*>\s*/g, '>')                                                                         // 113
                   .replace(/\s*\+\s*/g, '+');                                                                       // 114
  });                                                                                                                // 115
  return emit(selectors.join(','), node.position, true)                                                              // 116
    + emit('{')                                                                                                      // 117
    + mapVisit(decls)                                                                                                // 118
    + emit('}');                                                                                                     // 119
};                                                                                                                   // 120
                                                                                                                     // 121
traverse.declaration = function(node, last) {                                                                        // 122
  var value = node.value;                                                                                            // 123
                                                                                                                     // 124
  // remove optional quotes around font name                                                                         // 125
  if (node.property === 'font') {                                                                                    // 126
    value = value.replace(/\'[^\']+\'/g, function (m) {                                                              // 127
      if (m.indexOf(' ') !== -1)                                                                                     // 128
        return m;                                                                                                    // 129
      return m.replace(/\'/g, '');                                                                                   // 130
    });                                                                                                              // 131
    value = value.replace(/\"[^\"]+\"/g, function (m) {                                                              // 132
      if (m.indexOf(' ') !== -1)                                                                                     // 133
        return m;                                                                                                    // 134
      return m.replace(/\"/g, '');                                                                                   // 135
    });                                                                                                              // 136
  }                                                                                                                  // 137
  // remove url quotes if possible                                                                                   // 138
  // in case it is the last declaration, we can omit the semicolon                                                   // 139
  return emit(node.property + ':' + value, node.position)                                                            // 140
         + (last ? '' : emit(';'));                                                                                  // 141
};                                                                                                                   // 142
                                                                                                                     // 143
                                                                                                                     // 144
                                                                                                                     // 145
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minifiers/minifiers.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
UglifyJSMinify = Npm.require('uglify-js').minify;                                                                    // 1
                                                                                                                     // 2
var cssParse = Npm.require('css-parse');                                                                             // 3
var cssStringify = Npm.require('css-stringify');                                                                     // 4
var path = Npm.require('path');                                                                                      // 5
var url = Npm.require('url');                                                                                        // 6
                                                                                                                     // 7
CssTools = {                                                                                                         // 8
  parseCss: cssParse,                                                                                                // 9
  stringifyCss: cssStringify,                                                                                        // 10
  minifyCss: function (cssText) {                                                                                    // 11
    return CssTools.minifyCssAst(cssParse(cssText));                                                                 // 12
  },                                                                                                                 // 13
  minifyCssAst: function (cssAst) {                                                                                  // 14
    return MinifyAst(cssAst);                                                                                        // 15
  },                                                                                                                 // 16
  mergeCssAsts: function (cssAsts, warnCb) {                                                                         // 17
    var rulesPredicate = function (rules) {                                                                          // 18
      if (! _.isArray(rules))                                                                                        // 19
        rules = [rules];                                                                                             // 20
      return function (node) {                                                                                       // 21
        return _.contains(rules, node.type);                                                                         // 22
      }                                                                                                              // 23
    };                                                                                                               // 24
                                                                                                                     // 25
    // Simple concatenation of CSS files would break @import rules                                                   // 26
    // located in the beginning of a file. Before concatenation, pull them to                                        // 27
    // the beginning of a new syntax tree so they always precede other rules.                                        // 28
    var newAst = {                                                                                                   // 29
      type: 'stylesheet',                                                                                            // 30
      stylesheet: { rules: [] }                                                                                      // 31
    };                                                                                                               // 32
                                                                                                                     // 33
    _.each(cssAsts, function (ast) {                                                                                 // 34
      // Pick only the imports from the beginning of file ignoring @charset                                          // 35
      // rules as every file is assumed to be in UTF-8.                                                              // 36
      var charsetRules = _.filter(ast.stylesheet.rules,                                                              // 37
                                  rulesPredicate("charset"));                                                        // 38
                                                                                                                     // 39
      if (_.any(charsetRules, function (rule) {                                                                      // 40
        // According to MDN, only 'UTF-8' and "UTF-8" are the correct encoding                                       // 41
        // directives representing UTF-8.                                                                            // 42
        return ! /^(['"])UTF-8\1$/.test(rule.charset);                                                               // 43
      })) {                                                                                                          // 44
        warnCb(ast.filename, "@charset rules in this file will be ignored as UTF-8 is the only encoding supported"); // 45
      }                                                                                                              // 46
                                                                                                                     // 47
      ast.stylesheet.rules = _.reject(ast.stylesheet.rules,                                                          // 48
                                      rulesPredicate("charset"));                                                    // 49
      var importCount = 0;                                                                                           // 50
      for (var i = 0; i < ast.stylesheet.rules.length; i++)                                                          // 51
        if (! rulesPredicate(["import", "comment"])(ast.stylesheet.rules[i])) {                                      // 52
          importCount = i;                                                                                           // 53
          break;                                                                                                     // 54
        }                                                                                                            // 55
                                                                                                                     // 56
      CssTools.rewriteCssUrls(ast);                                                                                  // 57
                                                                                                                     // 58
      var imports = ast.stylesheet.rules.splice(0, importCount);                                                     // 59
      newAst.stylesheet.rules = newAst.stylesheet.rules.concat(imports);                                             // 60
                                                                                                                     // 61
      // if there are imports left in the middle of file, warn user as it might                                      // 62
      // be a potential bug (imports are valid only in the beginning of file).                                       // 63
      if (_.any(ast.stylesheet.rules, rulesPredicate("import"))) {                                                   // 64
        // XXX make this an error?                                                                                   // 65
        warnCb(ast.filename, "there are some @import rules those are not taking effect as they are required to be in the beginning of the file");
      }                                                                                                              // 67
                                                                                                                     // 68
    });                                                                                                              // 69
                                                                                                                     // 70
    // Now we can put the rest of CSS rules into new AST                                                             // 71
    _.each(cssAsts, function (ast) {                                                                                 // 72
      newAst.stylesheet.rules =                                                                                      // 73
        newAst.stylesheet.rules.concat(ast.stylesheet.rules);                                                        // 74
    });                                                                                                              // 75
                                                                                                                     // 76
    return newAst;                                                                                                   // 77
  },                                                                                                                 // 78
                                                                                                                     // 79
  // We are looking for all relative urls defined with the `url()` functional                                        // 80
  // notation and rewriting them to the equivalent absolute url using the                                            // 81
  // `position.source` path provided by css-parse                                                                    // 82
  // For performance reasons this function acts by side effect by modifying the                                      // 83
  // given AST without doing a deep copy.                                                                            // 84
  rewriteCssUrls: function (ast) {                                                                                   // 85
                                                                                                                     // 86
    var isRelative = function(path) {                                                                                // 87
      return path && path.charAt(0) !== '/';                                                                         // 88
    };                                                                                                               // 89
                                                                                                                     // 90
    _.each(ast.stylesheet.rules, function(rule, ruleIndex) {                                                         // 91
      var basePath = path.dirname(rule.position.source);                                                             // 92
                                                                                                                     // 93
      _.each(rule.declarations, function(declaration, declarationIndex) {                                            // 94
        var parts, resource, absolutePath, quotes, oldCssUrl, newCssUrl;                                             // 95
        var value = declaration.value;                                                                               // 96
                                                                                                                     // 97
        // Match css values containing some functional calls to `url(URI)` where                                     // 98
        // URI is optionally quoted.                                                                                 // 99
        // Note that a css value can contains other elements, for instance:                                          // 100
        //   background: top center url("background.png") black;                                                     // 101
        // or even multiple url(), for instance for multiple backgrounds.                                            // 102
        var cssUrlRegex = /url\s*\(\s*(['"]?)(.+?)\1\s*\)/gi;                                                        // 103
        while (parts = cssUrlRegex.exec(value)) {                                                                    // 104
          oldCssUrl = parts[0];                                                                                      // 105
          quotes = parts[1];                                                                                         // 106
          resource = url.parse(parts[2]);                                                                            // 107
                                                                                                                     // 108
          // Rewrite relative paths to absolute paths.                                                               // 109
          // We don't rewrite urls starting with a protocol definition such as                                       // 110
          // http, https, or data.                                                                                   // 111
          if (isRelative(resource.path) && resource.protocol === null) {                                             // 112
            absolutePath = path.join(basePath, resource.path);                                                       // 113
            newCssUrl = "url(" + quotes + absolutePath + quotes + ")";                                               // 114
            value = value.replace(oldCssUrl, newCssUrl);                                                             // 115
          }                                                                                                          // 116
        }                                                                                                            // 117
                                                                                                                     // 118
        declaration.value = value;                                                                                   // 119
      });                                                                                                            // 120
    });                                                                                                              // 121
  }                                                                                                                  // 122
};                                                                                                                   // 123
                                                                                                                     // 124
                                                                                                                     // 125
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.minifiers = {
  CssTools: CssTools,
  UglifyJSMinify: UglifyJSMinify
};

})();
