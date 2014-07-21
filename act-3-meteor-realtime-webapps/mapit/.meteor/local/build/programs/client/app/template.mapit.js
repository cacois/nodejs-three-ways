(function(){
UI.body.contentParts.push(UI.Component.extend({render: (function() {
  var self = this;
  return [ HTML.Raw("<!--BOOM. Free authentication. You can get the current user with Meteor.user(), or their userid by Meteor.userId() -->\n    "), HTML.DIV("\n      ", Spacebars.include(self.lookupTemplate("loginButtons")), "\n    "), "\n    ", HTML.DIV("\n      ", HTML.DIV({
    style: "width: 75%; margin: 10px; float: left"
  }, "\n        ", Spacebars.include(self.lookupTemplate("map")), "\n      "), "\n      ", HTML.DIV({
    style: "width: 20%; float: right; margin-top:90px;"
  }, "\n        ", Spacebars.include(self.lookupTemplate("markerlist")), "\n      "), "\n    ") ];
})}));
Meteor.startup(function () { if (! UI.body.INSTANTIATED) { UI.body.INSTANTIATED = true; UI.DomRange.insert(UI.render(UI.body).dom, document.body); } });

Template.__define__("map", (function() {
  var self = this;
  var template = this;
  return HTML.Raw('<div id="container">\n      <h1 class="title">Mapit!</h1>\n      <div id="map" class="map"></div>\n    </div>');
}));

Template.__define__("markerlist", (function() {
  var self = this;
  var template = this;
  return UI.Each(function() {
    return Spacebars.call(self.lookup("markers"));
  }, UI.block(function() {
    var self = this;
    return [ "\n    ", HTML.DIV("\n      ", HTML.B("Marker"), HTML.BR(), "\n      ", HTML.SPAN("-- Coordinates: ", function() {
      return Spacebars.mustache(self.lookup("coords"));
    }), HTML.BR(), "\n      ", HTML.SPAN("-- Added by user: ", function() {
      return Spacebars.mustache(self.lookup("user"));
    }), "\n    "), HTML.BR(), "\n  " ];
  }));
}));

Template.__define__("userlist", (function() {
  var self = this;
  var template = this;
  return UI.Each(function() {
    return Spacebars.call(self.lookup("users"));
  }, UI.block(function() {
    var self = this;
    return [ "\n      user:\n      ", function() {
      return Spacebars.mustache(self.lookup("user"));
    }, "\n    " ];
  }));
}));

})();
