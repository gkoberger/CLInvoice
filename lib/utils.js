var path = require('path')
  , fs = require('fs')

module.exports.multiplyTime = function(quantity, rate) {
  var i = quantity.match(/([0-9]+):([0-9]+)/)
  if(i) {
    quantity = (parseFloat(i[2]) / 60) + parseFloat(i[1])
  }
  return (parseFloat(quantity) * parseFloat(rate));
};

module.exports.absPath = function(p) {
  if(p.substr(0, 1) != '/' && p.substr(0, 1) != '~') {
    p = path.resolve(process.cwd(), p);
  }
  if(p.substr(0, 1) == '~') {
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    p = path.resolve(home, p.replace('~/', ''));
  }
  return p
};

module.exports.formatBool = function(bool) {
  return (bool.substr(0).toLowerCase() == "y")
};

module.exports.formatInt = function(i) {
  var i = parseInt(i);
  if(!i) return false;
  return i;
};

module.exports.pad = function(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

module.exports.getDirectories = function(dir) {
  return fs.readdirSync(dir).filter(function (file) {
    return fs.statSync(path.resolve(dir, file)).isDirectory();
  });
};
