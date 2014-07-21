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
var Deps = Package.deps.Deps;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var Accounts = Package['accounts-base'].Accounts;
var _ = Package.underscore._;
var Template = Package.templating.Template;
var Session = Package.session.Session;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var passwordSignupFields, displayName, getLoginServices, hasPasswordService, dropdown, validateUsername, validateEmail, validatePassword;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/accounts_ui.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Accounts.ui = {};                                                                                                      // 1
                                                                                                                       // 2
Accounts.ui._options = {                                                                                               // 3
  requestPermissions: {},                                                                                              // 4
  requestOfflineToken: {}                                                                                              // 5
};                                                                                                                     // 6
                                                                                                                       // 7
Accounts.ui.config = function(options) {                                                                               // 8
  // validate options keys                                                                                             // 9
  var VALID_KEYS = ['passwordSignupFields', 'requestPermissions', 'requestOfflineToken'];                              // 10
  _.each(_.keys(options), function (key) {                                                                             // 11
    if (!_.contains(VALID_KEYS, key))                                                                                  // 12
      throw new Error("Accounts.ui.config: Invalid key: " + key);                                                      // 13
  });                                                                                                                  // 14
                                                                                                                       // 15
  // deal with `passwordSignupFields`                                                                                  // 16
  if (options.passwordSignupFields) {                                                                                  // 17
    if (_.contains([                                                                                                   // 18
      "USERNAME_AND_EMAIL",                                                                                            // 19
      "USERNAME_AND_OPTIONAL_EMAIL",                                                                                   // 20
      "USERNAME_ONLY",                                                                                                 // 21
      "EMAIL_ONLY"                                                                                                     // 22
    ], options.passwordSignupFields)) {                                                                                // 23
      if (Accounts.ui._options.passwordSignupFields)                                                                   // 24
        throw new Error("Accounts.ui.config: Can't set `passwordSignupFields` more than once");                        // 25
      else                                                                                                             // 26
        Accounts.ui._options.passwordSignupFields = options.passwordSignupFields;                                      // 27
    } else {                                                                                                           // 28
      throw new Error("Accounts.ui.config: Invalid option for `passwordSignupFields`: " + options.passwordSignupFields);
    }                                                                                                                  // 30
  }                                                                                                                    // 31
                                                                                                                       // 32
  // deal with `requestPermissions`                                                                                    // 33
  if (options.requestPermissions) {                                                                                    // 34
    _.each(options.requestPermissions, function (scope, service) {                                                     // 35
      if (Accounts.ui._options.requestPermissions[service]) {                                                          // 36
        throw new Error("Accounts.ui.config: Can't set `requestPermissions` more than once for " + service);           // 37
      } else if (!(scope instanceof Array)) {                                                                          // 38
        throw new Error("Accounts.ui.config: Value for `requestPermissions` must be an array");                        // 39
      } else {                                                                                                         // 40
        Accounts.ui._options.requestPermissions[service] = scope;                                                      // 41
      }                                                                                                                // 42
    });                                                                                                                // 43
  }                                                                                                                    // 44
                                                                                                                       // 45
  // deal with `requestOfflineToken`                                                                                   // 46
  if (options.requestOfflineToken) {                                                                                   // 47
    _.each(options.requestOfflineToken, function (value, service) {                                                    // 48
      if (service !== 'google')                                                                                        // 49
        throw new Error("Accounts.ui.config: `requestOfflineToken` only supported for Google login at the moment.");   // 50
                                                                                                                       // 51
      if (Accounts.ui._options.requestOfflineToken[service]) {                                                         // 52
        throw new Error("Accounts.ui.config: Can't set `requestOfflineToken` more than once for " + service);          // 53
      } else {                                                                                                         // 54
        Accounts.ui._options.requestOfflineToken[service] = value;                                                     // 55
      }                                                                                                                // 56
    });                                                                                                                // 57
  }                                                                                                                    // 58
};                                                                                                                     // 59
                                                                                                                       // 60
passwordSignupFields = function () {                                                                                   // 61
  return Accounts.ui._options.passwordSignupFields || "EMAIL_ONLY";                                                    // 62
};                                                                                                                     // 63
                                                                                                                       // 64
                                                                                                                       // 65
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/template.login_buttons.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
                                                                                                                       // 1
Template.__define__("loginButtons", (function() {                                                                      // 2
  var self = this;                                                                                                     // 3
  var template = this;                                                                                                 // 4
  return HTML.DIV({                                                                                                    // 5
    id: "login-buttons",                                                                                               // 6
    "class": [ "login-buttons-dropdown-align-", function() {                                                           // 7
      return Spacebars.mustache(self.lookup("align"));                                                                 // 8
    } ]                                                                                                                // 9
  }, "\n    ", UI.If(function() {                                                                                      // 10
    return Spacebars.call(self.lookup("currentUser"));                                                                 // 11
  }, UI.block(function() {                                                                                             // 12
    var self = this;                                                                                                   // 13
    return [ "\n      ", UI.If(function() {                                                                            // 14
      return Spacebars.call(self.lookup("loggingIn"));                                                                 // 15
    }, UI.block(function() {                                                                                           // 16
      var self = this;                                                                                                 // 17
      return [ "\n        \n        ", UI.If(function() {                                                              // 18
        return Spacebars.call(self.lookup("dropdown"));                                                                // 19
      }, UI.block(function() {                                                                                         // 20
        var self = this;                                                                                               // 21
        return [ "\n          ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggingIn")), "\n        " ];     // 22
      }), UI.block(function() {                                                                                        // 23
        var self = this;                                                                                               // 24
        return [ "\n          ", HTML.DIV({                                                                            // 25
          "class": "login-buttons-with-only-one-button"                                                                // 26
        }, "\n            ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggingInSingleLoginButton")), "\n          "), "\n        " ];
      })), "\n      " ];                                                                                               // 28
    }), UI.block(function() {                                                                                          // 29
      var self = this;                                                                                                 // 30
      return [ "\n        ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedIn")), "\n      " ];            // 31
    })), "\n    " ];                                                                                                   // 32
  }), UI.block(function() {                                                                                            // 33
    var self = this;                                                                                                   // 34
    return [ "\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOut")), "\n    " ];                 // 35
  })), "\n  ");                                                                                                        // 36
}));                                                                                                                   // 37
                                                                                                                       // 38
Template.__define__("_loginButtonsLoggedIn", (function() {                                                             // 39
  var self = this;                                                                                                     // 40
  var template = this;                                                                                                 // 41
  return UI.If(function() {                                                                                            // 42
    return Spacebars.call(self.lookup("dropdown"));                                                                    // 43
  }, UI.block(function() {                                                                                             // 44
    var self = this;                                                                                                   // 45
    return [ "\n    ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedInDropdown")), "\n  " ];              // 46
  }), UI.block(function() {                                                                                            // 47
    var self = this;                                                                                                   // 48
    return [ "\n    ", HTML.DIV({                                                                                      // 49
      "class": "login-buttons-with-only-one-button"                                                                    // 50
    }, "\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedInSingleLogoutButton")), "\n    "), "\n  " ];
  }));                                                                                                                 // 52
}));                                                                                                                   // 53
                                                                                                                       // 54
Template.__define__("_loginButtonsLoggedOut", (function() {                                                            // 55
  var self = this;                                                                                                     // 56
  var template = this;                                                                                                 // 57
  return UI.If(function() {                                                                                            // 58
    return Spacebars.call(self.lookup("services"));                                                                    // 59
  }, UI.block(function() {                                                                                             // 60
    var self = this;                                                                                                   // 61
    return [ " \n    ", UI.If(function() {                                                                             // 62
      return Spacebars.call(self.lookup("configurationLoaded"));                                                       // 63
    }, UI.block(function() {                                                                                           // 64
      var self = this;                                                                                                 // 65
      return [ "\n      ", UI.If(function() {                                                                          // 66
        return Spacebars.call(self.lookup("dropdown"));                                                                // 67
      }, UI.block(function() {                                                                                         // 68
        var self = this;                                                                                               // 69
        return [ " \n        ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOutDropdown")), "\n      " ];
      }), UI.block(function() {                                                                                        // 71
        var self = this;                                                                                               // 72
        return [ "\n        ", Spacebars.With(function() {                                                             // 73
          return Spacebars.call(self.lookup("singleService"));                                                         // 74
        }, UI.block(function() {                                                                                       // 75
          var self = this;                                                                                             // 76
          return [ " \n          ", HTML.DIV({                                                                         // 77
            "class": "login-buttons-with-only-one-button"                                                              // 78
          }, "\n            ", UI.If(function() {                                                                      // 79
            return Spacebars.call(self.lookup("loggingIn"));                                                           // 80
          }, UI.block(function() {                                                                                     // 81
            var self = this;                                                                                           // 82
            return [ "\n              ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggingInSingleLoginButton")), "\n            " ];
          }), UI.block(function() {                                                                                    // 84
            var self = this;                                                                                           // 85
            return [ "\n              ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOutSingleLoginButton")), "\n            " ];
          })), "\n          "), "\n        " ];                                                                        // 87
        })), "\n      " ];                                                                                             // 88
      })), "\n    " ];                                                                                                 // 89
    })), "\n  " ];                                                                                                     // 90
  }), UI.block(function() {                                                                                            // 91
    var self = this;                                                                                                   // 92
    return [ "\n    ", HTML.DIV({                                                                                      // 93
      "class": "no-services"                                                                                           // 94
    }, "No login services configured"), "\n  " ];                                                                      // 95
  }));                                                                                                                 // 96
}));                                                                                                                   // 97
                                                                                                                       // 98
Template.__define__("_loginButtonsMessages", (function() {                                                             // 99
  var self = this;                                                                                                     // 100
  var template = this;                                                                                                 // 101
  return [ UI.If(function() {                                                                                          // 102
    return Spacebars.call(self.lookup("errorMessage"));                                                                // 103
  }, UI.block(function() {                                                                                             // 104
    var self = this;                                                                                                   // 105
    return [ "\n    ", HTML.DIV({                                                                                      // 106
      "class": "message error-message"                                                                                 // 107
    }, function() {                                                                                                    // 108
      return Spacebars.mustache(self.lookup("errorMessage"));                                                          // 109
    }), "\n  " ];                                                                                                      // 110
  })), "\n  ", UI.If(function() {                                                                                      // 111
    return Spacebars.call(self.lookup("infoMessage"));                                                                 // 112
  }, UI.block(function() {                                                                                             // 113
    var self = this;                                                                                                   // 114
    return [ "\n    ", HTML.DIV({                                                                                      // 115
      "class": "message info-message"                                                                                  // 116
    }, function() {                                                                                                    // 117
      return Spacebars.mustache(self.lookup("infoMessage"));                                                           // 118
    }), "\n  " ];                                                                                                      // 119
  })) ];                                                                                                               // 120
}));                                                                                                                   // 121
                                                                                                                       // 122
Template.__define__("_loginButtonsLoggingIn", (function() {                                                            // 123
  var self = this;                                                                                                     // 124
  var template = this;                                                                                                 // 125
  return [ Spacebars.include(self.lookupTemplate("_loginButtonsLoggingInPadding")), HTML.Raw('\n  <div class="loading">&nbsp;</div>\n  '), Spacebars.include(self.lookupTemplate("_loginButtonsLoggingInPadding")) ];
}));                                                                                                                   // 127
                                                                                                                       // 128
Template.__define__("_loginButtonsLoggingInPadding", (function() {                                                     // 129
  var self = this;                                                                                                     // 130
  var template = this;                                                                                                 // 131
  return UI.Unless(function() {                                                                                        // 132
    return Spacebars.call(self.lookup("dropdown"));                                                                    // 133
  }, UI.block(function() {                                                                                             // 134
    var self = this;                                                                                                   // 135
    return [ "\n    \n    ", HTML.DIV({                                                                                // 136
      "class": "login-buttons-padding"                                                                                 // 137
    }, "\n      ", HTML.DIV({                                                                                          // 138
      "class": "login-button single-login-button",                                                                     // 139
      style: "visibility: hidden;",                                                                                    // 140
      id: "login-buttons-logout"                                                                                       // 141
    }, HTML.CharRef({                                                                                                  // 142
      html: "&nbsp;",                                                                                                  // 143
      str: " "                                                                                                         // 144
    })), "\n    "), "\n  " ];                                                                                          // 145
  }), UI.block(function() {                                                                                            // 146
    var self = this;                                                                                                   // 147
    return [ "\n    \n    ", HTML.DIV({                                                                                // 148
      "class": "login-buttons-padding"                                                                                 // 149
    }), "\n  " ];                                                                                                      // 150
  }));                                                                                                                 // 151
}));                                                                                                                   // 152
                                                                                                                       // 153
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/template.login_buttons_single.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
                                                                                                                       // 1
Template.__define__("_loginButtonsLoggedOutSingleLoginButton", (function() {                                           // 2
  var self = this;                                                                                                     // 3
  var template = this;                                                                                                 // 4
  return HTML.DIV({                                                                                                    // 5
    "class": "login-text-and-button"                                                                                   // 6
  }, "\n    ", HTML.DIV({                                                                                              // 7
    "class": [ "login-button single-login-button ", UI.Unless(function() {                                             // 8
      return Spacebars.call(self.lookup("configured"));                                                                // 9
    }, UI.block(function() {                                                                                           // 10
      var self = this;                                                                                                 // 11
      return "configure-button";                                                                                       // 12
    })) ],                                                                                                             // 13
    id: [ "login-buttons-", function() {                                                                               // 14
      return Spacebars.mustache(self.lookup("name"));                                                                  // 15
    } ]                                                                                                                // 16
  }, "\n      ", HTML.DIV({                                                                                            // 17
    "class": "login-image",                                                                                            // 18
    id: [ "login-buttons-image-", function() {                                                                         // 19
      return Spacebars.mustache(self.lookup("name"));                                                                  // 20
    } ]                                                                                                                // 21
  }), "\n      ", UI.If(function() {                                                                                   // 22
    return Spacebars.call(self.lookup("configured"));                                                                  // 23
  }, UI.block(function() {                                                                                             // 24
    var self = this;                                                                                                   // 25
    return [ "\n        ", HTML.SPAN({                                                                                 // 26
      "class": [ "text-besides-image sign-in-text-", function() {                                                      // 27
        return Spacebars.mustache(self.lookup("name"));                                                                // 28
      } ]                                                                                                              // 29
    }, "Sign in with ", function() {                                                                                   // 30
      return Spacebars.mustache(self.lookup("capitalizedName"));                                                       // 31
    }), "\n      " ];                                                                                                  // 32
  }), UI.block(function() {                                                                                            // 33
    var self = this;                                                                                                   // 34
    return [ "\n        ", HTML.SPAN({                                                                                 // 35
      "class": [ "text-besides-image configure-text-", function() {                                                    // 36
        return Spacebars.mustache(self.lookup("name"));                                                                // 37
      } ]                                                                                                              // 38
    }, "Configure ", function() {                                                                                      // 39
      return Spacebars.mustache(self.lookup("capitalizedName"));                                                       // 40
    }, " Login"), "\n      " ];                                                                                        // 41
  })), "\n    "), "\n  ");                                                                                             // 42
}));                                                                                                                   // 43
                                                                                                                       // 44
Template.__define__("_loginButtonsLoggingInSingleLoginButton", (function() {                                           // 45
  var self = this;                                                                                                     // 46
  var template = this;                                                                                                 // 47
  return HTML.DIV({                                                                                                    // 48
    "class": "login-text-and-button"                                                                                   // 49
  }, "\n    ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggingIn")), "\n  ");                              // 50
}));                                                                                                                   // 51
                                                                                                                       // 52
Template.__define__("_loginButtonsLoggedInSingleLogoutButton", (function() {                                           // 53
  var self = this;                                                                                                     // 54
  var template = this;                                                                                                 // 55
  return HTML.DIV({                                                                                                    // 56
    "class": "login-text-and-button"                                                                                   // 57
  }, "\n    ", HTML.DIV({                                                                                              // 58
    "class": "login-display-name"                                                                                      // 59
  }, "\n      ", function() {                                                                                          // 60
    return Spacebars.mustache(self.lookup("displayName"));                                                             // 61
  }, "\n    "), HTML.Raw('\n    <div class="login-button single-login-button" id="login-buttons-logout">Sign Out</div>\n  '));
}));                                                                                                                   // 63
                                                                                                                       // 64
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/template.login_buttons_dropdown.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
                                                                                                                       // 1
Template.__define__("_loginButtonsLoggedInDropdown", (function() {                                                     // 2
  var self = this;                                                                                                     // 3
  var template = this;                                                                                                 // 4
  return HTML.DIV({                                                                                                    // 5
    "class": "login-link-and-dropdown-list"                                                                            // 6
  }, "\n    ", HTML.A({                                                                                                // 7
    "class": "login-link-text",                                                                                        // 8
    id: "login-name-link"                                                                                              // 9
  }, "\n      ", function() {                                                                                          // 10
    return Spacebars.mustache(self.lookup("displayName"));                                                             // 11
  }, " ▾\n    "), "\n\n    ", UI.If(function() {                                                                       // 12
    return Spacebars.call(self.lookup("dropdownVisible"));                                                             // 13
  }, UI.block(function() {                                                                                             // 14
    var self = this;                                                                                                   // 15
    return [ "\n      ", HTML.DIV({                                                                                    // 16
      id: "login-dropdown-list",                                                                                       // 17
      "class": "accounts-dialog"                                                                                       // 18
    }, "\n        ", HTML.A({                                                                                          // 19
      "class": "login-close-text"                                                                                      // 20
    }, "Close"), "\n        ", HTML.DIV({                                                                              // 21
      "class": "login-close-text-clear"                                                                                // 22
    }), "\n\n        ", UI.If(function() {                                                                             // 23
      return Spacebars.call(self.lookup("inMessageOnlyFlow"));                                                         // 24
    }, UI.block(function() {                                                                                           // 25
      var self = this;                                                                                                 // 26
      return [ "\n          ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), "\n        " ];        // 27
    }), UI.block(function() {                                                                                          // 28
      var self = this;                                                                                                 // 29
      return [ "\n          ", UI.If(function() {                                                                      // 30
        return Spacebars.call(self.lookup("inChangePasswordFlow"));                                                    // 31
      }, UI.block(function() {                                                                                         // 32
        var self = this;                                                                                               // 33
        return [ "\n            ", Spacebars.include(self.lookupTemplate("_loginButtonsChangePassword")), "\n          " ];
      }), UI.block(function() {                                                                                        // 35
        var self = this;                                                                                               // 36
        return [ "\n            ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedInDropdownActions")), "\n          " ];
      })), "\n        " ];                                                                                             // 38
    })), "\n      "), "\n    " ];                                                                                      // 39
  })), "\n  ");                                                                                                        // 40
}));                                                                                                                   // 41
                                                                                                                       // 42
Template.__define__("_loginButtonsLoggedInDropdownActions", (function() {                                              // 43
  var self = this;                                                                                                     // 44
  var template = this;                                                                                                 // 45
  return [ UI.If(function() {                                                                                          // 46
    return Spacebars.call(self.lookup("allowChangingPassword"));                                                       // 47
  }, UI.block(function() {                                                                                             // 48
    var self = this;                                                                                                   // 49
    return [ "\n    ", HTML.DIV({                                                                                      // 50
      "class": "login-button",                                                                                         // 51
      id: "login-buttons-open-change-password"                                                                         // 52
    }, "\n      Change password\n    "), "\n  " ];                                                                     // 53
  })), HTML.Raw('\n\n  <div class="login-button" id="login-buttons-logout">\n    Sign out\n  </div>\n\n  '), Spacebars.include(self.lookupTemplate("_loginButtonsMessages")) ];
}));                                                                                                                   // 55
                                                                                                                       // 56
Template.__define__("_loginButtonsLoggedOutDropdown", (function() {                                                    // 57
  var self = this;                                                                                                     // 58
  var template = this;                                                                                                 // 59
  return HTML.DIV({                                                                                                    // 60
    "class": [ "login-link-and-dropdown-list ", function() {                                                           // 61
      return Spacebars.mustache(self.lookup("additionalClasses"));                                                     // 62
    } ]                                                                                                                // 63
  }, "\n    ", UI.If(function() {                                                                                      // 64
    return Spacebars.call(self.lookup("dropdownVisible"));                                                             // 65
  }, UI.block(function() {                                                                                             // 66
    var self = this;                                                                                                   // 67
    return [ "\n      \n      ", HTML.A({                                                                              // 68
      "class": "login-link-text",                                                                                      // 69
      id: "login-sign-in-link"                                                                                         // 70
    }, "Sign in ▾"), "\n      ", HTML.DIV({                                                                            // 71
      id: "login-dropdown-list",                                                                                       // 72
      "class": "accounts-dialog"                                                                                       // 73
    }, "\n        ", HTML.A({                                                                                          // 74
      "class": "login-close-text"                                                                                      // 75
    }, "Close"), "\n        ", UI.If(function() {                                                                      // 76
      return Spacebars.call(self.lookup("loggingIn"));                                                                 // 77
    }, UI.block(function() {                                                                                           // 78
      var self = this;                                                                                                 // 79
      return [ "\n          ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggingIn")), "\n        " ];       // 80
    })), "\n        ", HTML.DIV({                                                                                      // 81
      "class": "login-close-text-clear"                                                                                // 82
    }), "\n        ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOutAllServices")), "\n      "), "\n    " ];
  }), UI.block(function() {                                                                                            // 84
    var self = this;                                                                                                   // 85
    return [ "\n      ", UI.If(function() {                                                                            // 86
      return Spacebars.call(self.lookup("loggingIn"));                                                                 // 87
    }, UI.block(function() {                                                                                           // 88
      var self = this;                                                                                                 // 89
      return [ "\n        \n        ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggingIn")), "\n      " ]; // 90
    }), UI.block(function() {                                                                                          // 91
      var self = this;                                                                                                 // 92
      return [ "\n        ", HTML.A({                                                                                  // 93
        "class": "login-link-text",                                                                                    // 94
        id: "login-sign-in-link"                                                                                       // 95
      }, "Sign in ▾"), "\n      " ];                                                                                   // 96
    })), "\n    " ];                                                                                                   // 97
  })), "\n  ");                                                                                                        // 98
}));                                                                                                                   // 99
                                                                                                                       // 100
Template.__define__("_loginButtonsLoggedOutAllServices", (function() {                                                 // 101
  var self = this;                                                                                                     // 102
  var template = this;                                                                                                 // 103
  return [ UI.Each(function() {                                                                                        // 104
    return Spacebars.call(self.lookup("services"));                                                                    // 105
  }, UI.block(function() {                                                                                             // 106
    var self = this;                                                                                                   // 107
    return [ "\n    ", UI.If(function() {                                                                              // 108
      return Spacebars.call(self.lookup("isPasswordService"));                                                         // 109
    }, UI.block(function() {                                                                                           // 110
      var self = this;                                                                                                 // 111
      return [ "\n      ", UI.If(function() {                                                                          // 112
        return Spacebars.call(self.lookup("hasOtherServices"));                                                        // 113
      }, UI.block(function() {                                                                                         // 114
        var self = this;                                                                                               // 115
        return [ " \n        ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOutPasswordServiceSeparator")), "\n      " ];
      })), "\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOutPasswordService")), "\n    " ];    // 117
    }), UI.block(function() {                                                                                          // 118
      var self = this;                                                                                                 // 119
      return [ "\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsLoggedOutSingleLoginButton")), "\n    " ];
    })), "\n  " ];                                                                                                     // 121
  })), "\n\n  ", UI.Unless(function() {                                                                                // 122
    return Spacebars.call(self.lookup("hasPasswordService"));                                                          // 123
  }, UI.block(function() {                                                                                             // 124
    var self = this;                                                                                                   // 125
    return [ "\n    ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), "\n  " ];                      // 126
  })) ];                                                                                                               // 127
}));                                                                                                                   // 128
                                                                                                                       // 129
Template.__define__("_loginButtonsLoggedOutPasswordServiceSeparator", (function() {                                    // 130
  var self = this;                                                                                                     // 131
  var template = this;                                                                                                 // 132
  return HTML.Raw('<div class="or">\n    <span class="hline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>\n    <span class="or-text">or</span>\n    <span class="hline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>\n  </div>');
}));                                                                                                                   // 134
                                                                                                                       // 135
Template.__define__("_loginButtonsLoggedOutPasswordService", (function() {                                             // 136
  var self = this;                                                                                                     // 137
  var template = this;                                                                                                 // 138
  return UI.If(function() {                                                                                            // 139
    return Spacebars.call(self.lookup("inForgotPasswordFlow"));                                                        // 140
  }, UI.block(function() {                                                                                             // 141
    var self = this;                                                                                                   // 142
    return [ "\n    ", Spacebars.include(self.lookupTemplate("_forgotPasswordForm")), "\n  " ];                        // 143
  }), UI.block(function() {                                                                                            // 144
    var self = this;                                                                                                   // 145
    return [ "\n    ", HTML.DIV({                                                                                      // 146
      "class": "login-form login-password-form"                                                                        // 147
    }, "\n      ", UI.Each(function() {                                                                                // 148
      return Spacebars.call(self.lookup("fields"));                                                                    // 149
    }, UI.block(function() {                                                                                           // 150
      var self = this;                                                                                                 // 151
      return [ "\n        ", Spacebars.include(self.lookupTemplate("_loginButtonsFormField")), "\n      " ];           // 152
    })), "\n\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), "\n\n      ", HTML.DIV({       // 153
      "class": "login-button login-button-form-submit",                                                                // 154
      id: "login-buttons-password"                                                                                     // 155
    }, "\n        ", UI.If(function() {                                                                                // 156
      return Spacebars.call(self.lookup("inSignupFlow"));                                                              // 157
    }, UI.block(function() {                                                                                           // 158
      var self = this;                                                                                                 // 159
      return "\n          Create account\n        ";                                                                   // 160
    }), UI.block(function() {                                                                                          // 161
      var self = this;                                                                                                 // 162
      return "\n          Sign in\n        ";                                                                          // 163
    })), "\n      "), "\n\n      ", UI.If(function() {                                                                 // 164
      return Spacebars.call(self.lookup("inLoginFlow"));                                                               // 165
    }, UI.block(function() {                                                                                           // 166
      var self = this;                                                                                                 // 167
      return [ "\n        ", UI.If(function() {                                                                        // 168
        return Spacebars.call(self.lookup("showCreateAccountLink"));                                                   // 169
      }, UI.block(function() {                                                                                         // 170
        var self = this;                                                                                               // 171
        return [ "\n          ", HTML.DIV({                                                                            // 172
          "class": "additional-link-container"                                                                         // 173
        }, "\n            ", HTML.A({                                                                                  // 174
          id: "signup-link",                                                                                           // 175
          "class": "additional-link"                                                                                   // 176
        }, "Create account"), "\n          "), "\n        " ];                                                         // 177
      })), "\n\n        ", UI.If(function() {                                                                          // 178
        return Spacebars.call(self.lookup("showForgotPasswordLink"));                                                  // 179
      }, UI.block(function() {                                                                                         // 180
        var self = this;                                                                                               // 181
        return [ "\n          ", HTML.DIV({                                                                            // 182
          "class": "additional-link-container"                                                                         // 183
        }, "\n            ", HTML.A({                                                                                  // 184
          id: "forgot-password-link",                                                                                  // 185
          "class": "additional-link"                                                                                   // 186
        }, "Forgot password"), "\n          "), "\n        " ];                                                        // 187
      })), "\n      " ];                                                                                               // 188
    })), "\n\n      ", UI.If(function() {                                                                              // 189
      return Spacebars.call(self.lookup("inSignupFlow"));                                                              // 190
    }, UI.block(function() {                                                                                           // 191
      var self = this;                                                                                                 // 192
      return [ "\n        ", Spacebars.include(self.lookupTemplate("_loginButtonsBackToLoginLink")), "\n      " ];     // 193
    })), "\n    "), "\n  " ];                                                                                          // 194
  }));                                                                                                                 // 195
}));                                                                                                                   // 196
                                                                                                                       // 197
Template.__define__("_forgotPasswordForm", (function() {                                                               // 198
  var self = this;                                                                                                     // 199
  var template = this;                                                                                                 // 200
  return HTML.DIV({                                                                                                    // 201
    "class": "login-form"                                                                                              // 202
  }, HTML.Raw('\n    <div id="forgot-password-email-label-and-input"> \n      <label id="forgot-password-email-label" for="forgot-password-email">Email</label>\n      <input id="forgot-password-email" type="email">\n    </div>\n\n    '), Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), HTML.Raw('\n\n    <div class="login-button login-button-form-submit" id="login-buttons-forgot-password">\n      Reset password\n    </div>\n\n    '), Spacebars.include(self.lookupTemplate("_loginButtonsBackToLoginLink")), "\n  ");
}));                                                                                                                   // 204
                                                                                                                       // 205
Template.__define__("_loginButtonsBackToLoginLink", (function() {                                                      // 206
  var self = this;                                                                                                     // 207
  var template = this;                                                                                                 // 208
  return HTML.Raw('<div class="additional-link-container">\n    <a id="back-to-login-link" class="additional-link">Sign in</a>\n  </div>');
}));                                                                                                                   // 210
                                                                                                                       // 211
Template.__define__("_loginButtonsFormField", (function() {                                                            // 212
  var self = this;                                                                                                     // 213
  var template = this;                                                                                                 // 214
  return UI.If(function() {                                                                                            // 215
    return Spacebars.call(self.lookup("visible"));                                                                     // 216
  }, UI.block(function() {                                                                                             // 217
    var self = this;                                                                                                   // 218
    return [ "\n    ", HTML.DIV({                                                                                      // 219
      id: [ "login-", function() {                                                                                     // 220
        return Spacebars.mustache(self.lookup("fieldName"));                                                           // 221
      }, "-label-and-input" ]                                                                                          // 222
    }, "\n      ", HTML.LABEL({                                                                                        // 223
      id: [ "login-", function() {                                                                                     // 224
        return Spacebars.mustache(self.lookup("fieldName"));                                                           // 225
      }, "-label" ],                                                                                                   // 226
      "for": [ "login-", function() {                                                                                  // 227
        return Spacebars.mustache(self.lookup("fieldName"));                                                           // 228
      } ]                                                                                                              // 229
    }, "\n        ", function() {                                                                                      // 230
      return Spacebars.mustache(self.lookup("fieldLabel"));                                                            // 231
    }, "\n      "), "\n      ", HTML.INPUT({                                                                           // 232
      id: [ "login-", function() {                                                                                     // 233
        return Spacebars.mustache(self.lookup("fieldName"));                                                           // 234
      } ],                                                                                                             // 235
      type: function() {                                                                                               // 236
        return Spacebars.mustache(self.lookup("inputType"));                                                           // 237
      }                                                                                                                // 238
    }), "\n    "), "\n  " ];                                                                                           // 239
  }));                                                                                                                 // 240
}));                                                                                                                   // 241
                                                                                                                       // 242
Template.__define__("_loginButtonsChangePassword", (function() {                                                       // 243
  var self = this;                                                                                                     // 244
  var template = this;                                                                                                 // 245
  return [ UI.Each(function() {                                                                                        // 246
    return Spacebars.call(self.lookup("fields"));                                                                      // 247
  }, UI.block(function() {                                                                                             // 248
    var self = this;                                                                                                   // 249
    return [ "\n    ", Spacebars.include(self.lookupTemplate("_loginButtonsFormField")), "\n  " ];                     // 250
  })), "\n\n  ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), HTML.Raw('\n\n  <div class="login-button login-button-form-submit" id="login-buttons-do-change-password">\n    Change password\n  </div>') ];
}));                                                                                                                   // 252
                                                                                                                       // 253
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/template.login_buttons_dialogs.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
                                                                                                                       // 1
UI.body.contentParts.push(UI.Component.extend({render: (function() {                                                   // 2
  var self = this;                                                                                                     // 3
  return [ Spacebars.include(self.lookupTemplate("_resetPasswordDialog")), "\n  ", Spacebars.include(self.lookupTemplate("_enrollAccountDialog")), "\n  ", Spacebars.include(self.lookupTemplate("_justVerifiedEmailDialog")), "\n  ", Spacebars.include(self.lookupTemplate("_configureLoginServiceDialog")), HTML.Raw("\n\n  <!-- if we're not showing a dropdown, we need some other place to show messages -->\n  "), Spacebars.include(self.lookupTemplate("_loginButtonsMessagesDialog")) ];
})}));                                                                                                                 // 5
Meteor.startup(function () { if (! UI.body.INSTANTIATED) { UI.body.INSTANTIATED = true; UI.DomRange.insert(UI.render(UI.body).dom, document.body); } });
                                                                                                                       // 7
Template.__define__("_resetPasswordDialog", (function() {                                                              // 8
  var self = this;                                                                                                     // 9
  var template = this;                                                                                                 // 10
  return UI.If(function() {                                                                                            // 11
    return Spacebars.call(self.lookup("inResetPasswordFlow"));                                                         // 12
  }, UI.block(function() {                                                                                             // 13
    var self = this;                                                                                                   // 14
    return [ "\n    ", HTML.DIV({                                                                                      // 15
      "class": "hide-background"                                                                                       // 16
    }), "\n\n    ", HTML.DIV({                                                                                         // 17
      "class": "accounts-dialog accounts-centered-dialog"                                                              // 18
    }, "\n      ", HTML.LABEL({                                                                                        // 19
      id: "reset-password-new-password-label",                                                                         // 20
      "for": "reset-password-new-password"                                                                             // 21
    }, "\n        New password\n      "), "\n\n      ", HTML.DIV({                                                     // 22
      "class": "reset-password-new-password-wrapper"                                                                   // 23
    }, "\n        ", HTML.INPUT({                                                                                      // 24
      id: "reset-password-new-password",                                                                               // 25
      type: "password"                                                                                                 // 26
    }), "\n      "), "\n\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), "\n\n      ", HTML.DIV({
      "class": "login-button login-button-form-submit",                                                                // 28
      id: "login-buttons-reset-password-button"                                                                        // 29
    }, "\n        Set password\n      "), "\n\n      ", HTML.A({                                                       // 30
      "class": "accounts-close",                                                                                       // 31
      id: "login-buttons-cancel-reset-password"                                                                        // 32
    }, HTML.CharRef({                                                                                                  // 33
      html: "&times;",                                                                                                 // 34
      str: "×"                                                                                                         // 35
    })), "\n    "), "\n  " ];                                                                                          // 36
  }));                                                                                                                 // 37
}));                                                                                                                   // 38
                                                                                                                       // 39
Template.__define__("_enrollAccountDialog", (function() {                                                              // 40
  var self = this;                                                                                                     // 41
  var template = this;                                                                                                 // 42
  return UI.If(function() {                                                                                            // 43
    return Spacebars.call(self.lookup("inEnrollAccountFlow"));                                                         // 44
  }, UI.block(function() {                                                                                             // 45
    var self = this;                                                                                                   // 46
    return [ "\n    ", HTML.DIV({                                                                                      // 47
      "class": "hide-background"                                                                                       // 48
    }), "\n\n    ", HTML.DIV({                                                                                         // 49
      "class": "accounts-dialog accounts-centered-dialog"                                                              // 50
    }, "\n      ", HTML.LABEL({                                                                                        // 51
      id: "enroll-account-password-label",                                                                             // 52
      "for": "enroll-account-password"                                                                                 // 53
    }, "\n        Choose a password\n      "), "\n\n      ", HTML.DIV({                                                // 54
      "class": "enroll-account-password-wrapper"                                                                       // 55
    }, "\n        ", HTML.INPUT({                                                                                      // 56
      id: "enroll-account-password",                                                                                   // 57
      type: "password"                                                                                                 // 58
    }), "\n      "), "\n\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), "\n\n      ", HTML.DIV({
      "class": "login-button login-button-form-submit",                                                                // 60
      id: "login-buttons-enroll-account-button"                                                                        // 61
    }, "\n        Create account\n      "), "\n\n      ", HTML.A({                                                     // 62
      "class": "accounts-close",                                                                                       // 63
      id: "login-buttons-cancel-enroll-account"                                                                        // 64
    }, HTML.CharRef({                                                                                                  // 65
      html: "&times;",                                                                                                 // 66
      str: "×"                                                                                                         // 67
    })), "\n    "), "\n  " ];                                                                                          // 68
  }));                                                                                                                 // 69
}));                                                                                                                   // 70
                                                                                                                       // 71
Template.__define__("_justVerifiedEmailDialog", (function() {                                                          // 72
  var self = this;                                                                                                     // 73
  var template = this;                                                                                                 // 74
  return UI.If(function() {                                                                                            // 75
    return Spacebars.call(self.lookup("visible"));                                                                     // 76
  }, UI.block(function() {                                                                                             // 77
    var self = this;                                                                                                   // 78
    return [ "\n    ", HTML.DIV({                                                                                      // 79
      "class": "accounts-dialog accounts-centered-dialog"                                                              // 80
    }, "\n      Email verified\n      ", HTML.DIV({                                                                    // 81
      "class": "login-button",                                                                                         // 82
      id: "just-verified-dismiss-button"                                                                               // 83
    }, "Dismiss"), "\n    "), "\n  " ];                                                                                // 84
  }));                                                                                                                 // 85
}));                                                                                                                   // 86
                                                                                                                       // 87
Template.__define__("_configureLoginServiceDialog", (function() {                                                      // 88
  var self = this;                                                                                                     // 89
  var template = this;                                                                                                 // 90
  return UI.If(function() {                                                                                            // 91
    return Spacebars.call(self.lookup("visible"));                                                                     // 92
  }, UI.block(function() {                                                                                             // 93
    var self = this;                                                                                                   // 94
    return [ "\n    ", HTML.DIV({                                                                                      // 95
      id: "configure-login-service-dialog",                                                                            // 96
      "class": "accounts-dialog accounts-centered-dialog"                                                              // 97
    }, "\n      ", Spacebars.include(self.lookupTemplate("configurationSteps")), "\n\n      ", HTML.P("\n        Now, copy over some details.\n      "), "\n      ", HTML.P("\n        ", HTML.TABLE("\n          ", HTML.COLGROUP("\n            ", HTML.COL({
      span: "1",                                                                                                       // 99
      "class": "configuration_labels"                                                                                  // 100
    }), "\n            ", HTML.COL({                                                                                   // 101
      span: "1",                                                                                                       // 102
      "class": "configuration_inputs"                                                                                  // 103
    }), "\n          "), "\n          ", UI.Each(function() {                                                          // 104
      return Spacebars.call(self.lookup("configurationFields"));                                                       // 105
    }, UI.block(function() {                                                                                           // 106
      var self = this;                                                                                                 // 107
      return [ "\n            ", HTML.TR("\n              ", HTML.TD("\n                ", HTML.LABEL({                // 108
        "for": [ "configure-login-service-dialog-", function() {                                                       // 109
          return Spacebars.mustache(self.lookup("property"));                                                          // 110
        } ]                                                                                                            // 111
      }, function() {                                                                                                  // 112
        return Spacebars.mustache(self.lookup("label"));                                                               // 113
      }), "\n              "), "\n              ", HTML.TD("\n                ", HTML.INPUT({                          // 114
        id: [ "configure-login-service-dialog-", function() {                                                          // 115
          return Spacebars.mustache(self.lookup("property"));                                                          // 116
        } ],                                                                                                           // 117
        type: "text"                                                                                                   // 118
      }), "\n              "), "\n            "), "\n          " ];                                                    // 119
    })), "\n        "), "\n      "), "\n      ", HTML.DIV({                                                            // 120
      "class": "new-section"                                                                                           // 121
    }, "\n        ", HTML.DIV({                                                                                        // 122
      "class": "login-button configure-login-service-dismiss-button"                                                   // 123
    }, "\n          I'll do this later\n        "), "\n        ", HTML.A({                                             // 124
      "class": "accounts-close configure-login-service-dismiss-button"                                                 // 125
    }, HTML.CharRef({                                                                                                  // 126
      html: "&times;",                                                                                                 // 127
      str: "×"                                                                                                         // 128
    })), "\n\n        ", HTML.DIV({                                                                                    // 129
      "class": [ "login-button login-button-configure ", UI.If(function() {                                            // 130
        return Spacebars.call(self.lookup("saveDisabled"));                                                            // 131
      }, UI.block(function() {                                                                                         // 132
        var self = this;                                                                                               // 133
        return "login-button-disabled";                                                                                // 134
      })) ],                                                                                                           // 135
      id: "configure-login-service-dialog-save-configuration"                                                          // 136
    }, "\n          Save Configuration\n        "), "\n      "), "\n    "), "\n  " ];                                  // 137
  }));                                                                                                                 // 138
}));                                                                                                                   // 139
                                                                                                                       // 140
Template.__define__("_loginButtonsMessagesDialog", (function() {                                                       // 141
  var self = this;                                                                                                     // 142
  var template = this;                                                                                                 // 143
  return UI.If(function() {                                                                                            // 144
    return Spacebars.call(self.lookup("visible"));                                                                     // 145
  }, UI.block(function() {                                                                                             // 146
    var self = this;                                                                                                   // 147
    return [ "\n    ", HTML.DIV({                                                                                      // 148
      "class": "accounts-dialog accounts-centered-dialog",                                                             // 149
      id: "login-buttons-message-dialog"                                                                               // 150
    }, "\n      ", Spacebars.include(self.lookupTemplate("_loginButtonsMessages")), "\n      ", HTML.DIV({             // 151
      "class": "login-button",                                                                                         // 152
      id: "messages-dialog-dismiss-button"                                                                             // 153
    }, "Dismiss"), "\n    "), "\n  " ];                                                                                // 154
  }));                                                                                                                 // 155
}));                                                                                                                   // 156
                                                                                                                       // 157
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/login_buttons_session.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var VALID_KEYS = [                                                                                                     // 1
  'dropdownVisible',                                                                                                   // 2
                                                                                                                       // 3
  // XXX consider replacing these with one key that has an enum for values.                                            // 4
  'inSignupFlow',                                                                                                      // 5
  'inForgotPasswordFlow',                                                                                              // 6
  'inChangePasswordFlow',                                                                                              // 7
  'inMessageOnlyFlow',                                                                                                 // 8
                                                                                                                       // 9
  'errorMessage',                                                                                                      // 10
  'infoMessage',                                                                                                       // 11
                                                                                                                       // 12
  // dialogs with messages (info and error)                                                                            // 13
  'resetPasswordToken',                                                                                                // 14
  'enrollAccountToken',                                                                                                // 15
  'justVerifiedEmail',                                                                                                 // 16
                                                                                                                       // 17
  'configureLoginServiceDialogVisible',                                                                                // 18
  'configureLoginServiceDialogServiceName',                                                                            // 19
  'configureLoginServiceDialogSaveDisabled'                                                                            // 20
];                                                                                                                     // 21
                                                                                                                       // 22
var validateKey = function (key) {                                                                                     // 23
  if (!_.contains(VALID_KEYS, key))                                                                                    // 24
    throw new Error("Invalid key in loginButtonsSession: " + key);                                                     // 25
};                                                                                                                     // 26
                                                                                                                       // 27
var KEY_PREFIX = "Meteor.loginButtons.";                                                                               // 28
                                                                                                                       // 29
// XXX This should probably be package scope rather than exported                                                      // 30
// (there was even a comment to that effect here from before we had                                                    // 31
// namespacing) but accounts-ui-viewer uses it, so leave it as is for                                                  // 32
// now                                                                                                                 // 33
Accounts._loginButtonsSession = {                                                                                      // 34
  set: function(key, value) {                                                                                          // 35
    validateKey(key);                                                                                                  // 36
    if (_.contains(['errorMessage', 'infoMessage'], key))                                                              // 37
      throw new Error("Don't set errorMessage or infoMessage directly. Instead, use errorMessage() or infoMessage().");
                                                                                                                       // 39
    this._set(key, value);                                                                                             // 40
  },                                                                                                                   // 41
                                                                                                                       // 42
  _set: function(key, value) {                                                                                         // 43
    Session.set(KEY_PREFIX + key, value);                                                                              // 44
  },                                                                                                                   // 45
                                                                                                                       // 46
  get: function(key) {                                                                                                 // 47
    validateKey(key);                                                                                                  // 48
    return Session.get(KEY_PREFIX + key);                                                                              // 49
  },                                                                                                                   // 50
                                                                                                                       // 51
  closeDropdown: function () {                                                                                         // 52
    this.set('inSignupFlow', false);                                                                                   // 53
    this.set('inForgotPasswordFlow', false);                                                                           // 54
    this.set('inChangePasswordFlow', false);                                                                           // 55
    this.set('inMessageOnlyFlow', false);                                                                              // 56
    this.set('dropdownVisible', false);                                                                                // 57
    this.resetMessages();                                                                                              // 58
  },                                                                                                                   // 59
                                                                                                                       // 60
  infoMessage: function(message) {                                                                                     // 61
    this._set("errorMessage", null);                                                                                   // 62
    this._set("infoMessage", message);                                                                                 // 63
    this.ensureMessageVisible();                                                                                       // 64
  },                                                                                                                   // 65
                                                                                                                       // 66
  errorMessage: function(message) {                                                                                    // 67
    this._set("errorMessage", message);                                                                                // 68
    this._set("infoMessage", null);                                                                                    // 69
    this.ensureMessageVisible();                                                                                       // 70
  },                                                                                                                   // 71
                                                                                                                       // 72
  // is there a visible dialog that shows messages (info and error)                                                    // 73
  isMessageDialogVisible: function () {                                                                                // 74
    return this.get('resetPasswordToken') ||                                                                           // 75
      this.get('enrollAccountToken') ||                                                                                // 76
      this.get('justVerifiedEmail');                                                                                   // 77
  },                                                                                                                   // 78
                                                                                                                       // 79
  // ensure that somethings displaying a message (info or error) is                                                    // 80
  // visible.  if a dialog with messages is open, do nothing;                                                          // 81
  // otherwise open the dropdown.                                                                                      // 82
  //                                                                                                                   // 83
  // notably this doesn't matter when only displaying a single login                                                   // 84
  // button since then we have an explicit message dialog                                                              // 85
  // (_loginButtonsMessageDialog), and dropdownVisible is ignored in                                                   // 86
  // this case.                                                                                                        // 87
  ensureMessageVisible: function () {                                                                                  // 88
    if (!this.isMessageDialogVisible())                                                                                // 89
      this.set("dropdownVisible", true);                                                                               // 90
  },                                                                                                                   // 91
                                                                                                                       // 92
  resetMessages: function () {                                                                                         // 93
    this._set("errorMessage", null);                                                                                   // 94
    this._set("infoMessage", null);                                                                                    // 95
  },                                                                                                                   // 96
                                                                                                                       // 97
  configureService: function (name) {                                                                                  // 98
    this.set('configureLoginServiceDialogVisible', true);                                                              // 99
    this.set('configureLoginServiceDialogServiceName', name);                                                          // 100
    this.set('configureLoginServiceDialogSaveDisabled', true);                                                         // 101
  }                                                                                                                    // 102
};                                                                                                                     // 103
                                                                                                                       // 104
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/login_buttons.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// for convenience                                                                                                     // 1
var loginButtonsSession = Accounts._loginButtonsSession;                                                               // 2
                                                                                                                       // 3
// shared between dropdown and single mode                                                                             // 4
Template.loginButtons.events({                                                                                         // 5
  'click #login-buttons-logout': function() {                                                                          // 6
    Meteor.logout(function () {                                                                                        // 7
      loginButtonsSession.closeDropdown();                                                                             // 8
    });                                                                                                                // 9
  }                                                                                                                    // 10
});                                                                                                                    // 11
                                                                                                                       // 12
UI.registerHelper('loginButtons', function () {                                                                        // 13
  throw new Error("Use {{> loginButtons}} instead of {{loginButtons}}");                                               // 14
});                                                                                                                    // 15
                                                                                                                       // 16
//                                                                                                                     // 17
// helpers                                                                                                             // 18
//                                                                                                                     // 19
                                                                                                                       // 20
displayName = function () {                                                                                            // 21
  var user = Meteor.user();                                                                                            // 22
  if (!user)                                                                                                           // 23
    return '';                                                                                                         // 24
                                                                                                                       // 25
  if (user.profile && user.profile.name)                                                                               // 26
    return user.profile.name;                                                                                          // 27
  if (user.username)                                                                                                   // 28
    return user.username;                                                                                              // 29
  if (user.emails && user.emails[0] && user.emails[0].address)                                                         // 30
    return user.emails[0].address;                                                                                     // 31
                                                                                                                       // 32
  return '';                                                                                                           // 33
};                                                                                                                     // 34
                                                                                                                       // 35
// returns an array of the login services used by this app. each                                                       // 36
// element of the array is an object (eg {name: 'facebook'}), since                                                    // 37
// that makes it useful in combination with handlebars {{#each}}.                                                      // 38
//                                                                                                                     // 39
// don't cache the output of this function: if called during startup (before                                           // 40
// oauth packages load) it might not include them all.                                                                 // 41
//                                                                                                                     // 42
// NOTE: It is very important to have this return password last                                                        // 43
// because of the way we render the different providers in                                                             // 44
// login_buttons_dropdown.html                                                                                         // 45
getLoginServices = function () {                                                                                       // 46
  var self = this;                                                                                                     // 47
                                                                                                                       // 48
  // First look for OAuth services.                                                                                    // 49
  var services = Package['accounts-oauth'] ? Accounts.oauth.serviceNames() : [];                                       // 50
                                                                                                                       // 51
  // Be equally kind to all login services. This also preserves                                                        // 52
  // backwards-compatibility. (But maybe order should be                                                               // 53
  // configurable?)                                                                                                    // 54
  services.sort();                                                                                                     // 55
                                                                                                                       // 56
  // Add password, if it's there; it must come last.                                                                   // 57
  if (hasPasswordService())                                                                                            // 58
    services.push('password');                                                                                         // 59
                                                                                                                       // 60
  return _.map(services, function(name) {                                                                              // 61
    return {name: name};                                                                                               // 62
  });                                                                                                                  // 63
};                                                                                                                     // 64
                                                                                                                       // 65
hasPasswordService = function () {                                                                                     // 66
  return !!Package['accounts-password'];                                                                               // 67
};                                                                                                                     // 68
                                                                                                                       // 69
dropdown = function () {                                                                                               // 70
  return hasPasswordService() || getLoginServices().length > 1;                                                        // 71
};                                                                                                                     // 72
                                                                                                                       // 73
// XXX improve these. should this be in accounts-password instead?                                                     // 74
//                                                                                                                     // 75
// XXX these will become configurable, and will be validated on                                                        // 76
// the server as well.                                                                                                 // 77
validateUsername = function (username) {                                                                               // 78
  if (username.length >= 3) {                                                                                          // 79
    return true;                                                                                                       // 80
  } else {                                                                                                             // 81
    loginButtonsSession.errorMessage("Username must be at least 3 characters long");                                   // 82
    return false;                                                                                                      // 83
  }                                                                                                                    // 84
};                                                                                                                     // 85
validateEmail = function (email) {                                                                                     // 86
  if (passwordSignupFields() === "USERNAME_AND_OPTIONAL_EMAIL" && email === '')                                        // 87
    return true;                                                                                                       // 88
                                                                                                                       // 89
  if (email.indexOf('@') !== -1) {                                                                                     // 90
    return true;                                                                                                       // 91
  } else {                                                                                                             // 92
    loginButtonsSession.errorMessage("Invalid email");                                                                 // 93
    return false;                                                                                                      // 94
  }                                                                                                                    // 95
};                                                                                                                     // 96
validatePassword = function (password) {                                                                               // 97
  if (password.length >= 6) {                                                                                          // 98
    return true;                                                                                                       // 99
  } else {                                                                                                             // 100
    loginButtonsSession.errorMessage("Password must be at least 6 characters long");                                   // 101
    return false;                                                                                                      // 102
  }                                                                                                                    // 103
};                                                                                                                     // 104
                                                                                                                       // 105
//                                                                                                                     // 106
// loginButtonLoggedOut template                                                                                       // 107
//                                                                                                                     // 108
                                                                                                                       // 109
Template._loginButtonsLoggedOut.dropdown = dropdown;                                                                   // 110
                                                                                                                       // 111
Template._loginButtonsLoggedOut.services = getLoginServices;                                                           // 112
                                                                                                                       // 113
Template._loginButtonsLoggedOut.singleService = function () {                                                          // 114
  var services = getLoginServices();                                                                                   // 115
  if (services.length !== 1)                                                                                           // 116
    throw new Error(                                                                                                   // 117
      "Shouldn't be rendering this template with more than one configured service");                                   // 118
  return services[0];                                                                                                  // 119
};                                                                                                                     // 120
                                                                                                                       // 121
Template._loginButtonsLoggedOut.configurationLoaded = function () {                                                    // 122
  return Accounts.loginServicesConfigured();                                                                           // 123
};                                                                                                                     // 124
                                                                                                                       // 125
                                                                                                                       // 126
//                                                                                                                     // 127
// loginButtonsLoggedIn template                                                                                       // 128
//                                                                                                                     // 129
                                                                                                                       // 130
// decide whether we should show a dropdown rather than a row of                                                       // 131
// buttons                                                                                                             // 132
Template._loginButtonsLoggedIn.dropdown = dropdown;                                                                    // 133
                                                                                                                       // 134
                                                                                                                       // 135
                                                                                                                       // 136
//                                                                                                                     // 137
// loginButtonsLoggedInSingleLogoutButton template                                                                     // 138
//                                                                                                                     // 139
                                                                                                                       // 140
Template._loginButtonsLoggedInSingleLogoutButton.displayName = displayName;                                            // 141
                                                                                                                       // 142
                                                                                                                       // 143
                                                                                                                       // 144
//                                                                                                                     // 145
// loginButtonsMessage template                                                                                        // 146
//                                                                                                                     // 147
                                                                                                                       // 148
Template._loginButtonsMessages.errorMessage = function () {                                                            // 149
  return loginButtonsSession.get('errorMessage');                                                                      // 150
};                                                                                                                     // 151
                                                                                                                       // 152
Template._loginButtonsMessages.infoMessage = function () {                                                             // 153
  return loginButtonsSession.get('infoMessage');                                                                       // 154
};                                                                                                                     // 155
                                                                                                                       // 156
                                                                                                                       // 157
//                                                                                                                     // 158
// loginButtonsLoggingInPadding template                                                                               // 159
//                                                                                                                     // 160
                                                                                                                       // 161
Template._loginButtonsLoggingInPadding.dropdown = dropdown;                                                            // 162
                                                                                                                       // 163
                                                                                                                       // 164
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/login_buttons_single.js                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// for convenience                                                                                                     // 1
var loginButtonsSession = Accounts._loginButtonsSession;                                                               // 2
                                                                                                                       // 3
Template._loginButtonsLoggedOutSingleLoginButton.events({                                                              // 4
  'click .login-button': function () {                                                                                 // 5
    var serviceName = this.name;                                                                                       // 6
    loginButtonsSession.resetMessages();                                                                               // 7
    var callback = function (err) {                                                                                    // 8
      if (!err) {                                                                                                      // 9
        loginButtonsSession.closeDropdown();                                                                           // 10
      } else if (err instanceof Accounts.LoginCancelledError) {                                                        // 11
        // do nothing                                                                                                  // 12
      } else if (err instanceof ServiceConfiguration.ConfigError) {                                                    // 13
        loginButtonsSession.configureService(serviceName);                                                             // 14
      } else {                                                                                                         // 15
        loginButtonsSession.errorMessage(err.reason || "Unknown error");                                               // 16
      }                                                                                                                // 17
    };                                                                                                                 // 18
                                                                                                                       // 19
    // XXX Service providers should be able to specify their                                                           // 20
    // `Meteor.loginWithX` method name.                                                                                // 21
    var loginWithService = Meteor["loginWith" +                                                                        // 22
                                  (serviceName === 'meteor-developer' ?                                                // 23
                                   'MeteorDeveloperAccount' :                                                          // 24
                                   capitalize(serviceName))];                                                          // 25
                                                                                                                       // 26
    var options = {}; // use default scope unless specified                                                            // 27
    if (Accounts.ui._options.requestPermissions[serviceName])                                                          // 28
      options.requestPermissions = Accounts.ui._options.requestPermissions[serviceName];                               // 29
    if (Accounts.ui._options.requestOfflineToken[serviceName])                                                         // 30
      options.requestOfflineToken = Accounts.ui._options.requestOfflineToken[serviceName];                             // 31
                                                                                                                       // 32
    loginWithService(options, callback);                                                                               // 33
  }                                                                                                                    // 34
});                                                                                                                    // 35
                                                                                                                       // 36
Template._loginButtonsLoggedOutSingleLoginButton.configured = function () {                                            // 37
  return !!ServiceConfiguration.configurations.findOne({service: this.name});                                          // 38
};                                                                                                                     // 39
                                                                                                                       // 40
Template._loginButtonsLoggedOutSingleLoginButton.capitalizedName = function () {                                       // 41
  if (this.name === 'github')                                                                                          // 42
    // XXX we should allow service packages to set their capitalized name                                              // 43
    return 'GitHub';                                                                                                   // 44
  else if (this.name === 'meteor-developer')                                                                           // 45
    return 'Meteor';                                                                                                   // 46
  else                                                                                                                 // 47
    return capitalize(this.name);                                                                                      // 48
};                                                                                                                     // 49
                                                                                                                       // 50
// XXX from http://epeli.github.com/underscore.string/lib/underscore.string.js                                         // 51
var capitalize = function(str){                                                                                        // 52
  str = str == null ? '' : String(str);                                                                                // 53
  return str.charAt(0).toUpperCase() + str.slice(1);                                                                   // 54
};                                                                                                                     // 55
                                                                                                                       // 56
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/login_buttons_dropdown.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// for convenience                                                                                                     // 1
var loginButtonsSession = Accounts._loginButtonsSession;                                                               // 2
                                                                                                                       // 3
// events shared between loginButtonsLoggedOutDropdown and                                                             // 4
// loginButtonsLoggedInDropdown                                                                                        // 5
Template.loginButtons.events({                                                                                         // 6
  'click #login-name-link, click #login-sign-in-link': function () {                                                   // 7
    loginButtonsSession.set('dropdownVisible', true);                                                                  // 8
    Deps.flush();                                                                                                      // 9
    correctDropdownZIndexes();                                                                                         // 10
  },                                                                                                                   // 11
  'click .login-close-text': function () {                                                                             // 12
    loginButtonsSession.closeDropdown();                                                                               // 13
  }                                                                                                                    // 14
});                                                                                                                    // 15
                                                                                                                       // 16
                                                                                                                       // 17
//                                                                                                                     // 18
// loginButtonsLoggedInDropdown template and related                                                                   // 19
//                                                                                                                     // 20
                                                                                                                       // 21
Template._loginButtonsLoggedInDropdown.events({                                                                        // 22
  'click #login-buttons-open-change-password': function() {                                                            // 23
    loginButtonsSession.resetMessages();                                                                               // 24
    loginButtonsSession.set('inChangePasswordFlow', true);                                                             // 25
  }                                                                                                                    // 26
});                                                                                                                    // 27
                                                                                                                       // 28
Template._loginButtonsLoggedInDropdown.displayName = displayName;                                                      // 29
                                                                                                                       // 30
Template._loginButtonsLoggedInDropdown.inChangePasswordFlow = function () {                                            // 31
  return loginButtonsSession.get('inChangePasswordFlow');                                                              // 32
};                                                                                                                     // 33
                                                                                                                       // 34
Template._loginButtonsLoggedInDropdown.inMessageOnlyFlow = function () {                                               // 35
  return loginButtonsSession.get('inMessageOnlyFlow');                                                                 // 36
};                                                                                                                     // 37
                                                                                                                       // 38
Template._loginButtonsLoggedInDropdown.dropdownVisible = function () {                                                 // 39
  return loginButtonsSession.get('dropdownVisible');                                                                   // 40
};                                                                                                                     // 41
                                                                                                                       // 42
Template._loginButtonsLoggedInDropdownActions.allowChangingPassword = function () {                                    // 43
  // it would be more correct to check whether the user has a password set,                                            // 44
  // but in order to do that we'd have to send more data down to the client,                                           // 45
  // and it'd be preferable not to send down the entire service.password document.                                     // 46
  //                                                                                                                   // 47
  // instead we use the heuristic: if the user has a username or email set.                                            // 48
  var user = Meteor.user();                                                                                            // 49
  return user.username || (user.emails && user.emails[0] && user.emails[0].address);                                   // 50
};                                                                                                                     // 51
                                                                                                                       // 52
                                                                                                                       // 53
//                                                                                                                     // 54
// loginButtonsLoggedOutDropdown template and related                                                                  // 55
//                                                                                                                     // 56
                                                                                                                       // 57
Template._loginButtonsLoggedOutDropdown.events({                                                                       // 58
  'click #login-buttons-password': function () {                                                                       // 59
    loginOrSignup();                                                                                                   // 60
  },                                                                                                                   // 61
                                                                                                                       // 62
  'keypress #forgot-password-email': function (event) {                                                                // 63
    if (event.keyCode === 13)                                                                                          // 64
      forgotPassword();                                                                                                // 65
  },                                                                                                                   // 66
                                                                                                                       // 67
  'click #login-buttons-forgot-password': function () {                                                                // 68
    forgotPassword();                                                                                                  // 69
  },                                                                                                                   // 70
                                                                                                                       // 71
  'click #signup-link': function () {                                                                                  // 72
    loginButtonsSession.resetMessages();                                                                               // 73
                                                                                                                       // 74
    // store values of fields before swtiching to the signup form                                                      // 75
    var username = trimmedElementValueById('login-username');                                                          // 76
    var email = trimmedElementValueById('login-email');                                                                // 77
    var usernameOrEmail = trimmedElementValueById('login-username-or-email');                                          // 78
    // notably not trimmed. a password could (?) start or end with a space                                             // 79
    var password = elementValueById('login-password');                                                                 // 80
                                                                                                                       // 81
    loginButtonsSession.set('inSignupFlow', true);                                                                     // 82
    loginButtonsSession.set('inForgotPasswordFlow', false);                                                            // 83
    // force the ui to update so that we have the approprate fields to fill in                                         // 84
    Deps.flush();                                                                                                      // 85
                                                                                                                       // 86
    // update new fields with appropriate defaults                                                                     // 87
    if (username !== null)                                                                                             // 88
      document.getElementById('login-username').value = username;                                                      // 89
    else if (email !== null)                                                                                           // 90
      document.getElementById('login-email').value = email;                                                            // 91
    else if (usernameOrEmail !== null)                                                                                 // 92
      if (usernameOrEmail.indexOf('@') === -1)                                                                         // 93
        document.getElementById('login-username').value = usernameOrEmail;                                             // 94
    else                                                                                                               // 95
      document.getElementById('login-email').value = usernameOrEmail;                                                  // 96
                                                                                                                       // 97
    if (password !== null)                                                                                             // 98
      document.getElementById('login-password').value = password;                                                      // 99
                                                                                                                       // 100
    // Force redrawing the `login-dropdown-list` element because of                                                    // 101
    // a bizarre Chrome bug in which part of the DIV is not redrawn                                                    // 102
    // in case you had tried to unsuccessfully log in before                                                           // 103
    // switching to the signup form.                                                                                   // 104
    //                                                                                                                 // 105
    // Found tip on how to force a redraw on                                                                           // 106
    // http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes/3485654#3485654
    var redraw = document.getElementById('login-dropdown-list');                                                       // 108
    redraw.style.display = 'none';                                                                                     // 109
    redraw.offsetHeight; // it seems that this line does nothing but is necessary for the redraw to work               // 110
    redraw.style.display = 'block';                                                                                    // 111
  },                                                                                                                   // 112
  'click #forgot-password-link': function () {                                                                         // 113
    loginButtonsSession.resetMessages();                                                                               // 114
                                                                                                                       // 115
    // store values of fields before swtiching to the signup form                                                      // 116
    var email = trimmedElementValueById('login-email');                                                                // 117
    var usernameOrEmail = trimmedElementValueById('login-username-or-email');                                          // 118
                                                                                                                       // 119
    loginButtonsSession.set('inSignupFlow', false);                                                                    // 120
    loginButtonsSession.set('inForgotPasswordFlow', true);                                                             // 121
    // force the ui to update so that we have the approprate fields to fill in                                         // 122
    Deps.flush();                                                                                                      // 123
                                                                                                                       // 124
    // update new fields with appropriate defaults                                                                     // 125
    if (email !== null)                                                                                                // 126
      document.getElementById('forgot-password-email').value = email;                                                  // 127
    else if (usernameOrEmail !== null)                                                                                 // 128
      if (usernameOrEmail.indexOf('@') !== -1)                                                                         // 129
        document.getElementById('forgot-password-email').value = usernameOrEmail;                                      // 130
                                                                                                                       // 131
  },                                                                                                                   // 132
  'click #back-to-login-link': function () {                                                                           // 133
    loginButtonsSession.resetMessages();                                                                               // 134
                                                                                                                       // 135
    var username = trimmedElementValueById('login-username');                                                          // 136
    var email = trimmedElementValueById('login-email')                                                                 // 137
          || trimmedElementValueById('forgot-password-email'); // Ughh. Standardize on names?                          // 138
    // notably not trimmed. a password could (?) start or end with a space                                             // 139
    var password = elementValueById('login-password');                                                                 // 140
                                                                                                                       // 141
    loginButtonsSession.set('inSignupFlow', false);                                                                    // 142
    loginButtonsSession.set('inForgotPasswordFlow', false);                                                            // 143
    // force the ui to update so that we have the approprate fields to fill in                                         // 144
    Deps.flush();                                                                                                      // 145
                                                                                                                       // 146
    if (document.getElementById('login-username'))                                                                     // 147
      document.getElementById('login-username').value = username;                                                      // 148
    if (document.getElementById('login-email'))                                                                        // 149
      document.getElementById('login-email').value = email;                                                            // 150
                                                                                                                       // 151
    if (document.getElementById('login-username-or-email'))                                                            // 152
      document.getElementById('login-username-or-email').value = email || username;                                    // 153
                                                                                                                       // 154
    if (password !== null)                                                                                             // 155
      document.getElementById('login-password').value = password;                                                      // 156
  },                                                                                                                   // 157
  'keypress #login-username, keypress #login-email, keypress #login-username-or-email, keypress #login-password, keypress #login-password-again': function (event) {
    if (event.keyCode === 13)                                                                                          // 159
      loginOrSignup();                                                                                                 // 160
  }                                                                                                                    // 161
});                                                                                                                    // 162
                                                                                                                       // 163
// additional classes that can be helpful in styling the dropdown                                                      // 164
Template._loginButtonsLoggedOutDropdown.additionalClasses = function () {                                              // 165
  if (!hasPasswordService()) {                                                                                         // 166
    return false;                                                                                                      // 167
  } else {                                                                                                             // 168
    if (loginButtonsSession.get('inSignupFlow')) {                                                                     // 169
      return 'login-form-create-account';                                                                              // 170
    } else if (loginButtonsSession.get('inForgotPasswordFlow')) {                                                      // 171
      return 'login-form-forgot-password';                                                                             // 172
    } else {                                                                                                           // 173
      return 'login-form-sign-in';                                                                                     // 174
    }                                                                                                                  // 175
  }                                                                                                                    // 176
};                                                                                                                     // 177
                                                                                                                       // 178
Template._loginButtonsLoggedOutDropdown.dropdownVisible = function () {                                                // 179
  return loginButtonsSession.get('dropdownVisible');                                                                   // 180
};                                                                                                                     // 181
                                                                                                                       // 182
Template._loginButtonsLoggedOutDropdown.hasPasswordService = hasPasswordService;                                       // 183
                                                                                                                       // 184
// return all login services, with password last                                                                       // 185
Template._loginButtonsLoggedOutAllServices.services = getLoginServices;                                                // 186
                                                                                                                       // 187
Template._loginButtonsLoggedOutAllServices.isPasswordService = function () {                                           // 188
  return this.name === 'password';                                                                                     // 189
};                                                                                                                     // 190
                                                                                                                       // 191
Template._loginButtonsLoggedOutAllServices.hasOtherServices = function () {                                            // 192
  return getLoginServices().length > 1;                                                                                // 193
};                                                                                                                     // 194
                                                                                                                       // 195
Template._loginButtonsLoggedOutAllServices.hasPasswordService =                                                        // 196
  hasPasswordService;                                                                                                  // 197
                                                                                                                       // 198
Template._loginButtonsLoggedOutPasswordService.fields = function () {                                                  // 199
  var loginFields = [                                                                                                  // 200
    {fieldName: 'username-or-email', fieldLabel: 'Username or Email',                                                  // 201
     visible: function () {                                                                                            // 202
       return _.contains(                                                                                              // 203
         ["USERNAME_AND_EMAIL", "USERNAME_AND_OPTIONAL_EMAIL"],                                                        // 204
         passwordSignupFields());                                                                                      // 205
     }},                                                                                                               // 206
    {fieldName: 'username', fieldLabel: 'Username',                                                                    // 207
     visible: function () {                                                                                            // 208
       return passwordSignupFields() === "USERNAME_ONLY";                                                              // 209
     }},                                                                                                               // 210
    {fieldName: 'email', fieldLabel: 'Email', inputType: 'email',                                                      // 211
     visible: function () {                                                                                            // 212
       return passwordSignupFields() === "EMAIL_ONLY";                                                                 // 213
     }},                                                                                                               // 214
    {fieldName: 'password', fieldLabel: 'Password', inputType: 'password',                                             // 215
     visible: function () {                                                                                            // 216
       return true;                                                                                                    // 217
     }}                                                                                                                // 218
  ];                                                                                                                   // 219
                                                                                                                       // 220
  var signupFields = [                                                                                                 // 221
    {fieldName: 'username', fieldLabel: 'Username',                                                                    // 222
     visible: function () {                                                                                            // 223
       return _.contains(                                                                                              // 224
         ["USERNAME_AND_EMAIL", "USERNAME_AND_OPTIONAL_EMAIL", "USERNAME_ONLY"],                                       // 225
         passwordSignupFields());                                                                                      // 226
     }},                                                                                                               // 227
    {fieldName: 'email', fieldLabel: 'Email', inputType: 'email',                                                      // 228
     visible: function () {                                                                                            // 229
       return _.contains(                                                                                              // 230
         ["USERNAME_AND_EMAIL", "EMAIL_ONLY"],                                                                         // 231
         passwordSignupFields());                                                                                      // 232
     }},                                                                                                               // 233
    {fieldName: 'email', fieldLabel: 'Email (optional)', inputType: 'email',                                           // 234
     visible: function () {                                                                                            // 235
       return passwordSignupFields() === "USERNAME_AND_OPTIONAL_EMAIL";                                                // 236
     }},                                                                                                               // 237
    {fieldName: 'password', fieldLabel: 'Password', inputType: 'password',                                             // 238
     visible: function () {                                                                                            // 239
       return true;                                                                                                    // 240
     }},                                                                                                               // 241
    {fieldName: 'password-again', fieldLabel: 'Password (again)',                                                      // 242
     inputType: 'password',                                                                                            // 243
     visible: function () {                                                                                            // 244
       // No need to make users double-enter their password if                                                         // 245
       // they'll necessarily have an email set, since they can use                                                    // 246
       // the "forgot password" flow.                                                                                  // 247
       return _.contains(                                                                                              // 248
         ["USERNAME_AND_OPTIONAL_EMAIL", "USERNAME_ONLY"],                                                             // 249
         passwordSignupFields());                                                                                      // 250
     }}                                                                                                                // 251
  ];                                                                                                                   // 252
                                                                                                                       // 253
  return loginButtonsSession.get('inSignupFlow') ? signupFields : loginFields;                                         // 254
};                                                                                                                     // 255
                                                                                                                       // 256
Template._loginButtonsLoggedOutPasswordService.inForgotPasswordFlow = function () {                                    // 257
  return loginButtonsSession.get('inForgotPasswordFlow');                                                              // 258
};                                                                                                                     // 259
                                                                                                                       // 260
Template._loginButtonsLoggedOutPasswordService.inLoginFlow = function () {                                             // 261
  return !loginButtonsSession.get('inSignupFlow') && !loginButtonsSession.get('inForgotPasswordFlow');                 // 262
};                                                                                                                     // 263
                                                                                                                       // 264
Template._loginButtonsLoggedOutPasswordService.inSignupFlow = function () {                                            // 265
  return loginButtonsSession.get('inSignupFlow');                                                                      // 266
};                                                                                                                     // 267
                                                                                                                       // 268
Template._loginButtonsLoggedOutPasswordService.showCreateAccountLink = function () {                                   // 269
  return !Accounts._options.forbidClientAccountCreation;                                                               // 270
};                                                                                                                     // 271
                                                                                                                       // 272
Template._loginButtonsLoggedOutPasswordService.showForgotPasswordLink = function () {                                  // 273
  return _.contains(                                                                                                   // 274
    ["USERNAME_AND_EMAIL", "USERNAME_AND_OPTIONAL_EMAIL", "EMAIL_ONLY"],                                               // 275
    passwordSignupFields());                                                                                           // 276
};                                                                                                                     // 277
                                                                                                                       // 278
Template._loginButtonsFormField.inputType = function () {                                                              // 279
  return this.inputType || "text";                                                                                     // 280
};                                                                                                                     // 281
                                                                                                                       // 282
                                                                                                                       // 283
//                                                                                                                     // 284
// loginButtonsChangePassword template                                                                                 // 285
//                                                                                                                     // 286
                                                                                                                       // 287
Template._loginButtonsChangePassword.events({                                                                          // 288
  'keypress #login-old-password, keypress #login-password, keypress #login-password-again': function (event) {         // 289
    if (event.keyCode === 13)                                                                                          // 290
      changePassword();                                                                                                // 291
  },                                                                                                                   // 292
  'click #login-buttons-do-change-password': function () {                                                             // 293
    changePassword();                                                                                                  // 294
  }                                                                                                                    // 295
});                                                                                                                    // 296
                                                                                                                       // 297
Template._loginButtonsChangePassword.fields = function () {                                                            // 298
  return [                                                                                                             // 299
    {fieldName: 'old-password', fieldLabel: 'Current Password', inputType: 'password',                                 // 300
     visible: function () {                                                                                            // 301
       return true;                                                                                                    // 302
     }},                                                                                                               // 303
    {fieldName: 'password', fieldLabel: 'New Password', inputType: 'password',                                         // 304
     visible: function () {                                                                                            // 305
       return true;                                                                                                    // 306
     }},                                                                                                               // 307
    {fieldName: 'password-again', fieldLabel: 'New Password (again)',                                                  // 308
     inputType: 'password',                                                                                            // 309
     visible: function () {                                                                                            // 310
       // No need to make users double-enter their password if                                                         // 311
       // they'll necessarily have an email set, since they can use                                                    // 312
       // the "forgot password" flow.                                                                                  // 313
       return _.contains(                                                                                              // 314
         ["USERNAME_AND_OPTIONAL_EMAIL", "USERNAME_ONLY"],                                                             // 315
         passwordSignupFields());                                                                                      // 316
     }}                                                                                                                // 317
  ];                                                                                                                   // 318
};                                                                                                                     // 319
                                                                                                                       // 320
                                                                                                                       // 321
//                                                                                                                     // 322
// helpers                                                                                                             // 323
//                                                                                                                     // 324
                                                                                                                       // 325
var elementValueById = function(id) {                                                                                  // 326
  var element = document.getElementById(id);                                                                           // 327
  if (!element)                                                                                                        // 328
    return null;                                                                                                       // 329
  else                                                                                                                 // 330
    return element.value;                                                                                              // 331
};                                                                                                                     // 332
                                                                                                                       // 333
var trimmedElementValueById = function(id) {                                                                           // 334
  var element = document.getElementById(id);                                                                           // 335
  if (!element)                                                                                                        // 336
    return null;                                                                                                       // 337
  else                                                                                                                 // 338
    return element.value.replace(/^\s*|\s*$/g, ""); // trim() doesn't work on IE8;                                     // 339
};                                                                                                                     // 340
                                                                                                                       // 341
var loginOrSignup = function () {                                                                                      // 342
  if (loginButtonsSession.get('inSignupFlow'))                                                                         // 343
    signup();                                                                                                          // 344
  else                                                                                                                 // 345
    login();                                                                                                           // 346
};                                                                                                                     // 347
                                                                                                                       // 348
var login = function () {                                                                                              // 349
  loginButtonsSession.resetMessages();                                                                                 // 350
                                                                                                                       // 351
  var username = trimmedElementValueById('login-username');                                                            // 352
  var email = trimmedElementValueById('login-email');                                                                  // 353
  var usernameOrEmail = trimmedElementValueById('login-username-or-email');                                            // 354
  // notably not trimmed. a password could (?) start or end with a space                                               // 355
  var password = elementValueById('login-password');                                                                   // 356
                                                                                                                       // 357
  var loginSelector;                                                                                                   // 358
  if (username !== null) {                                                                                             // 359
    if (!validateUsername(username))                                                                                   // 360
      return;                                                                                                          // 361
    else                                                                                                               // 362
      loginSelector = {username: username};                                                                            // 363
  } else if (email !== null) {                                                                                         // 364
    if (!validateEmail(email))                                                                                         // 365
      return;                                                                                                          // 366
    else                                                                                                               // 367
      loginSelector = {email: email};                                                                                  // 368
  } else if (usernameOrEmail !== null) {                                                                               // 369
    // XXX not sure how we should validate this. but this seems good enough (for now),                                 // 370
    // since an email must have at least 3 characters anyways                                                          // 371
    if (!validateUsername(usernameOrEmail))                                                                            // 372
      return;                                                                                                          // 373
    else                                                                                                               // 374
      loginSelector = usernameOrEmail;                                                                                 // 375
  } else {                                                                                                             // 376
    throw new Error("Unexpected -- no element to use as a login user selector");                                       // 377
  }                                                                                                                    // 378
                                                                                                                       // 379
  Meteor.loginWithPassword(loginSelector, password, function (error, result) {                                         // 380
    if (error) {                                                                                                       // 381
      loginButtonsSession.errorMessage(error.reason || "Unknown error");                                               // 382
    } else {                                                                                                           // 383
      loginButtonsSession.closeDropdown();                                                                             // 384
    }                                                                                                                  // 385
  });                                                                                                                  // 386
};                                                                                                                     // 387
                                                                                                                       // 388
var signup = function () {                                                                                             // 389
  loginButtonsSession.resetMessages();                                                                                 // 390
                                                                                                                       // 391
  var options = {}; // to be passed to Accounts.createUser                                                             // 392
                                                                                                                       // 393
  var username = trimmedElementValueById('login-username');                                                            // 394
  if (username !== null) {                                                                                             // 395
    if (!validateUsername(username))                                                                                   // 396
      return;                                                                                                          // 397
    else                                                                                                               // 398
      options.username = username;                                                                                     // 399
  }                                                                                                                    // 400
                                                                                                                       // 401
  var email = trimmedElementValueById('login-email');                                                                  // 402
  if (email !== null) {                                                                                                // 403
    if (!validateEmail(email))                                                                                         // 404
      return;                                                                                                          // 405
    else                                                                                                               // 406
      options.email = email;                                                                                           // 407
  }                                                                                                                    // 408
                                                                                                                       // 409
  // notably not trimmed. a password could (?) start or end with a space                                               // 410
  var password = elementValueById('login-password');                                                                   // 411
  if (!validatePassword(password))                                                                                     // 412
    return;                                                                                                            // 413
  else                                                                                                                 // 414
    options.password = password;                                                                                       // 415
                                                                                                                       // 416
  if (!matchPasswordAgainIfPresent())                                                                                  // 417
    return;                                                                                                            // 418
                                                                                                                       // 419
  Accounts.createUser(options, function (error) {                                                                      // 420
    if (error) {                                                                                                       // 421
      loginButtonsSession.errorMessage(error.reason || "Unknown error");                                               // 422
    } else {                                                                                                           // 423
      loginButtonsSession.closeDropdown();                                                                             // 424
    }                                                                                                                  // 425
  });                                                                                                                  // 426
};                                                                                                                     // 427
                                                                                                                       // 428
var forgotPassword = function () {                                                                                     // 429
  loginButtonsSession.resetMessages();                                                                                 // 430
                                                                                                                       // 431
  var email = trimmedElementValueById("forgot-password-email");                                                        // 432
  if (email.indexOf('@') !== -1) {                                                                                     // 433
    Accounts.forgotPassword({email: email}, function (error) {                                                         // 434
      if (error)                                                                                                       // 435
        loginButtonsSession.errorMessage(error.reason || "Unknown error");                                             // 436
      else                                                                                                             // 437
        loginButtonsSession.infoMessage("Email sent");                                                                 // 438
    });                                                                                                                // 439
  } else {                                                                                                             // 440
    loginButtonsSession.errorMessage("Invalid email");                                                                 // 441
  }                                                                                                                    // 442
};                                                                                                                     // 443
                                                                                                                       // 444
var changePassword = function () {                                                                                     // 445
  loginButtonsSession.resetMessages();                                                                                 // 446
                                                                                                                       // 447
  // notably not trimmed. a password could (?) start or end with a space                                               // 448
  var oldPassword = elementValueById('login-old-password');                                                            // 449
                                                                                                                       // 450
  // notably not trimmed. a password could (?) start or end with a space                                               // 451
  var password = elementValueById('login-password');                                                                   // 452
  if (!validatePassword(password))                                                                                     // 453
    return;                                                                                                            // 454
                                                                                                                       // 455
  if (!matchPasswordAgainIfPresent())                                                                                  // 456
    return;                                                                                                            // 457
                                                                                                                       // 458
  Accounts.changePassword(oldPassword, password, function (error) {                                                    // 459
    if (error) {                                                                                                       // 460
      loginButtonsSession.errorMessage(error.reason || "Unknown error");                                               // 461
    } else {                                                                                                           // 462
      loginButtonsSession.set('inChangePasswordFlow', false);                                                          // 463
      loginButtonsSession.set('inMessageOnlyFlow', true);                                                              // 464
      loginButtonsSession.infoMessage("Password changed");                                                             // 465
    }                                                                                                                  // 466
  });                                                                                                                  // 467
};                                                                                                                     // 468
                                                                                                                       // 469
var matchPasswordAgainIfPresent = function () {                                                                        // 470
  // notably not trimmed. a password could (?) start or end with a space                                               // 471
  var passwordAgain = elementValueById('login-password-again');                                                        // 472
  if (passwordAgain !== null) {                                                                                        // 473
    // notably not trimmed. a password could (?) start or end with a space                                             // 474
    var password = elementValueById('login-password');                                                                 // 475
    if (password !== passwordAgain) {                                                                                  // 476
      loginButtonsSession.errorMessage("Passwords don't match");                                                       // 477
      return false;                                                                                                    // 478
    }                                                                                                                  // 479
  }                                                                                                                    // 480
  return true;                                                                                                         // 481
};                                                                                                                     // 482
                                                                                                                       // 483
var correctDropdownZIndexes = function () {                                                                            // 484
  // IE <= 7 has a z-index bug that means we can't just give the                                                       // 485
  // dropdown a z-index and expect it to stack above the rest of                                                       // 486
  // the page even if nothing else has a z-index.  The nature of                                                       // 487
  // the bug is that all positioned elements are considered to                                                         // 488
  // have z-index:0 (not auto) and therefore start new stacking                                                        // 489
  // contexts, with ties broken by page order.                                                                         // 490
  //                                                                                                                   // 491
  // The fix, then is to give z-index:1 to all ancestors                                                               // 492
  // of the dropdown having z-index:0.                                                                                 // 493
  for(var n = document.getElementById('login-dropdown-list').parentNode;                                               // 494
      n.nodeName !== 'BODY';                                                                                           // 495
      n = n.parentNode)                                                                                                // 496
    if (n.style.zIndex === 0)                                                                                          // 497
      n.style.zIndex = 1;                                                                                              // 498
};                                                                                                                     // 499
                                                                                                                       // 500
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-ui-unstyled/login_buttons_dialogs.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// for convenience                                                                                                     // 1
var loginButtonsSession = Accounts._loginButtonsSession;                                                               // 2
                                                                                                                       // 3
                                                                                                                       // 4
//                                                                                                                     // 5
// populate the session so that the appropriate dialogs are                                                            // 6
// displayed by reading variables set by accounts-urls, which parses                                                   // 7
// special URLs. since accounts-ui depends on accounts-urls, we are                                                    // 8
// guaranteed to have these set at this point.                                                                         // 9
//                                                                                                                     // 10
                                                                                                                       // 11
if (Accounts._resetPasswordToken) {                                                                                    // 12
  loginButtonsSession.set('resetPasswordToken', Accounts._resetPasswordToken);                                         // 13
}                                                                                                                      // 14
                                                                                                                       // 15
if (Accounts._enrollAccountToken) {                                                                                    // 16
  loginButtonsSession.set('enrollAccountToken', Accounts._enrollAccountToken);                                         // 17
}                                                                                                                      // 18
                                                                                                                       // 19
// Needs to be in Meteor.startup because of a package loading order                                                    // 20
// issue. We can't be sure that accounts-password is loaded earlier                                                    // 21
// than accounts-ui so Accounts.verifyEmail might not be defined.                                                      // 22
Meteor.startup(function () {                                                                                           // 23
  if (Accounts._verifyEmailToken) {                                                                                    // 24
    Accounts.verifyEmail(Accounts._verifyEmailToken, function(error) {                                                 // 25
      Accounts._enableAutoLogin();                                                                                     // 26
      if (!error)                                                                                                      // 27
        loginButtonsSession.set('justVerifiedEmail', true);                                                            // 28
      // XXX show something if there was an error.                                                                     // 29
    });                                                                                                                // 30
  }                                                                                                                    // 31
});                                                                                                                    // 32
                                                                                                                       // 33
                                                                                                                       // 34
//                                                                                                                     // 35
// resetPasswordDialog template                                                                                        // 36
//                                                                                                                     // 37
                                                                                                                       // 38
Template._resetPasswordDialog.events({                                                                                 // 39
  'click #login-buttons-reset-password-button': function () {                                                          // 40
    resetPassword();                                                                                                   // 41
  },                                                                                                                   // 42
  'keypress #reset-password-new-password': function (event) {                                                          // 43
    if (event.keyCode === 13)                                                                                          // 44
      resetPassword();                                                                                                 // 45
  },                                                                                                                   // 46
  'click #login-buttons-cancel-reset-password': function () {                                                          // 47
    loginButtonsSession.set('resetPasswordToken', null);                                                               // 48
    Accounts._enableAutoLogin();                                                                                       // 49
  }                                                                                                                    // 50
});                                                                                                                    // 51
                                                                                                                       // 52
var resetPassword = function () {                                                                                      // 53
  loginButtonsSession.resetMessages();                                                                                 // 54
  var newPassword = document.getElementById('reset-password-new-password').value;                                      // 55
  if (!validatePassword(newPassword))                                                                                  // 56
    return;                                                                                                            // 57
                                                                                                                       // 58
  Accounts.resetPassword(                                                                                              // 59
    loginButtonsSession.get('resetPasswordToken'), newPassword,                                                        // 60
    function (error) {                                                                                                 // 61
      if (error) {                                                                                                     // 62
        loginButtonsSession.errorMessage(error.reason || "Unknown error");                                             // 63
      } else {                                                                                                         // 64
        loginButtonsSession.set('resetPasswordToken', null);                                                           // 65
        Accounts._enableAutoLogin();                                                                                   // 66
      }                                                                                                                // 67
    });                                                                                                                // 68
};                                                                                                                     // 69
                                                                                                                       // 70
Template._resetPasswordDialog.inResetPasswordFlow = function () {                                                      // 71
  return loginButtonsSession.get('resetPasswordToken');                                                                // 72
};                                                                                                                     // 73
                                                                                                                       // 74
                                                                                                                       // 75
//                                                                                                                     // 76
// enrollAccountDialog template                                                                                        // 77
//                                                                                                                     // 78
                                                                                                                       // 79
Template._enrollAccountDialog.events({                                                                                 // 80
  'click #login-buttons-enroll-account-button': function () {                                                          // 81
    enrollAccount();                                                                                                   // 82
  },                                                                                                                   // 83
  'keypress #enroll-account-password': function (event) {                                                              // 84
    if (event.keyCode === 13)                                                                                          // 85
      enrollAccount();                                                                                                 // 86
  },                                                                                                                   // 87
  'click #login-buttons-cancel-enroll-account': function () {                                                          // 88
    loginButtonsSession.set('enrollAccountToken', null);                                                               // 89
    Accounts._enableAutoLogin();                                                                                       // 90
  }                                                                                                                    // 91
});                                                                                                                    // 92
                                                                                                                       // 93
var enrollAccount = function () {                                                                                      // 94
  loginButtonsSession.resetMessages();                                                                                 // 95
  var password = document.getElementById('enroll-account-password').value;                                             // 96
  if (!validatePassword(password))                                                                                     // 97
    return;                                                                                                            // 98
                                                                                                                       // 99
  Accounts.resetPassword(                                                                                              // 100
    loginButtonsSession.get('enrollAccountToken'), password,                                                           // 101
    function (error) {                                                                                                 // 102
      if (error) {                                                                                                     // 103
        loginButtonsSession.errorMessage(error.reason || "Unknown error");                                             // 104
      } else {                                                                                                         // 105
        loginButtonsSession.set('enrollAccountToken', null);                                                           // 106
        Accounts._enableAutoLogin();                                                                                   // 107
      }                                                                                                                // 108
    });                                                                                                                // 109
};                                                                                                                     // 110
                                                                                                                       // 111
Template._enrollAccountDialog.inEnrollAccountFlow = function () {                                                      // 112
  return loginButtonsSession.get('enrollAccountToken');                                                                // 113
};                                                                                                                     // 114
                                                                                                                       // 115
                                                                                                                       // 116
//                                                                                                                     // 117
// justVerifiedEmailDialog template                                                                                    // 118
//                                                                                                                     // 119
                                                                                                                       // 120
Template._justVerifiedEmailDialog.events({                                                                             // 121
  'click #just-verified-dismiss-button': function () {                                                                 // 122
    loginButtonsSession.set('justVerifiedEmail', false);                                                               // 123
  }                                                                                                                    // 124
});                                                                                                                    // 125
                                                                                                                       // 126
Template._justVerifiedEmailDialog.visible = function () {                                                              // 127
  return loginButtonsSession.get('justVerifiedEmail');                                                                 // 128
};                                                                                                                     // 129
                                                                                                                       // 130
                                                                                                                       // 131
//                                                                                                                     // 132
// loginButtonsMessagesDialog template                                                                                 // 133
//                                                                                                                     // 134
                                                                                                                       // 135
Template._loginButtonsMessagesDialog.events({                                                                          // 136
  'click #messages-dialog-dismiss-button': function () {                                                               // 137
    loginButtonsSession.resetMessages();                                                                               // 138
  }                                                                                                                    // 139
});                                                                                                                    // 140
                                                                                                                       // 141
Template._loginButtonsMessagesDialog.visible = function () {                                                           // 142
  var hasMessage = loginButtonsSession.get('infoMessage') || loginButtonsSession.get('errorMessage');                  // 143
  return !dropdown() && hasMessage;                                                                                    // 144
};                                                                                                                     // 145
                                                                                                                       // 146
                                                                                                                       // 147
//                                                                                                                     // 148
// configureLoginServiceDialog template                                                                                // 149
//                                                                                                                     // 150
                                                                                                                       // 151
Template._configureLoginServiceDialog.events({                                                                         // 152
  'click .configure-login-service-dismiss-button': function () {                                                       // 153
    loginButtonsSession.set('configureLoginServiceDialogVisible', false);                                              // 154
  },                                                                                                                   // 155
  'click #configure-login-service-dialog-save-configuration': function () {                                            // 156
    if (loginButtonsSession.get('configureLoginServiceDialogVisible') &&                                               // 157
        ! loginButtonsSession.get('configureLoginServiceDialogSaveDisabled')) {                                        // 158
      // Prepare the configuration document for this login service                                                     // 159
      var serviceName = loginButtonsSession.get('configureLoginServiceDialogServiceName');                             // 160
      var configuration = {                                                                                            // 161
        service: serviceName                                                                                           // 162
      };                                                                                                               // 163
                                                                                                                       // 164
      // Fetch the value of each input field                                                                           // 165
      _.each(configurationFields(), function(field) {                                                                  // 166
        configuration[field.property] = document.getElementById(                                                       // 167
          'configure-login-service-dialog-' + field.property).value                                                    // 168
          .replace(/^\s*|\s*$/g, ""); // trim() doesnt work on IE8;                                                    // 169
      });                                                                                                              // 170
                                                                                                                       // 171
      // Configure this login service                                                                                  // 172
      Accounts.connection.call(                                                                                        // 173
        "configureLoginService", configuration, function (error, result) {                                             // 174
          if (error)                                                                                                   // 175
            Meteor._debug("Error configuring login service " + serviceName,                                            // 176
                          error);                                                                                      // 177
          else                                                                                                         // 178
            loginButtonsSession.set('configureLoginServiceDialogVisible',                                              // 179
                                    false);                                                                            // 180
        });                                                                                                            // 181
    }                                                                                                                  // 182
  },                                                                                                                   // 183
  // IE8 doesn't support the 'input' event, so we'll run this on the keyup as                                          // 184
  // well. (Keeping the 'input' event means that this also fires when you use                                          // 185
  // the mouse to change the contents of the field, eg 'Cut' menu item.)                                               // 186
  'input, keyup input': function (event) {                                                                             // 187
    // if the event fired on one of the configuration input fields,                                                    // 188
    // check whether we should enable the 'save configuration' button                                                  // 189
    if (event.target.id.indexOf('configure-login-service-dialog') === 0)                                               // 190
      updateSaveDisabled();                                                                                            // 191
  }                                                                                                                    // 192
});                                                                                                                    // 193
                                                                                                                       // 194
// check whether the 'save configuration' button should be enabled.                                                    // 195
// this is a really strange way to implement this and a Forms                                                          // 196
// Abstraction would make all of this reactive, and simpler.                                                           // 197
var updateSaveDisabled = function () {                                                                                 // 198
  var anyFieldEmpty = _.any(configurationFields(), function(field) {                                                   // 199
    return document.getElementById(                                                                                    // 200
      'configure-login-service-dialog-' + field.property).value === '';                                                // 201
  });                                                                                                                  // 202
                                                                                                                       // 203
  loginButtonsSession.set('configureLoginServiceDialogSaveDisabled', anyFieldEmpty);                                   // 204
};                                                                                                                     // 205
                                                                                                                       // 206
// Returns the appropriate template for this login service.  This                                                      // 207
// template should be defined in the service's package                                                                 // 208
var configureLoginServiceDialogTemplateForService = function () {                                                      // 209
  var serviceName = loginButtonsSession.get('configureLoginServiceDialogServiceName');                                 // 210
  // XXX Service providers should be able to specify their configuration                                               // 211
  // template name.                                                                                                    // 212
  return Template['configureLoginServiceDialogFor' +                                                                   // 213
                  (serviceName === 'meteor-developer' ?                                                                // 214
                   'MeteorDeveloper' :                                                                                 // 215
                   capitalize(serviceName))];                                                                          // 216
};                                                                                                                     // 217
                                                                                                                       // 218
var configurationFields = function () {                                                                                // 219
  var template = configureLoginServiceDialogTemplateForService();                                                      // 220
  return template.fields();                                                                                            // 221
};                                                                                                                     // 222
                                                                                                                       // 223
Template._configureLoginServiceDialog.configurationFields = function () {                                              // 224
  return configurationFields();                                                                                        // 225
};                                                                                                                     // 226
                                                                                                                       // 227
Template._configureLoginServiceDialog.visible = function () {                                                          // 228
  return loginButtonsSession.get('configureLoginServiceDialogVisible');                                                // 229
};                                                                                                                     // 230
                                                                                                                       // 231
Template._configureLoginServiceDialog.configurationSteps = function () {                                               // 232
  // renders the appropriate template                                                                                  // 233
  return configureLoginServiceDialogTemplateForService();                                                              // 234
};                                                                                                                     // 235
                                                                                                                       // 236
Template._configureLoginServiceDialog.saveDisabled = function () {                                                     // 237
  return loginButtonsSession.get('configureLoginServiceDialogSaveDisabled');                                           // 238
};                                                                                                                     // 239
                                                                                                                       // 240
// XXX from http://epeli.github.com/underscore.string/lib/underscore.string.js                                         // 241
var capitalize = function(str){                                                                                        // 242
  str = str == null ? '' : String(str);                                                                                // 243
  return str.charAt(0).toUpperCase() + str.slice(1);                                                                   // 244
};                                                                                                                     // 245
                                                                                                                       // 246
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['accounts-ui-unstyled'] = {};

})();

//# sourceMappingURL=ad471c128f10d77553dbed2a2fd5b788e77b60e8.map
