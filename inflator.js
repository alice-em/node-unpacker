var fs = require('fs');
var tarball = require('tarball-extract');
var async = require('async');
var Q = require('q');
var zlib = require('zlib');
var p7zip = require('node-7z');
var isThere = require('is-there');

function extract7Zip(path, outpath, q) {
  isThere(outpath, function(exists) {
    if (exists) {
      var expander = new p7zip();
      expander.test(path, {p: ''}).then(function() {
        expander.extractFull(path, outpath).then(function() {
          q.resolve(outpath);
        }).catch(function(e) {
          q.reject(e);
        });
      }).catch(function(e) {
        if (!e)
          e = new Error('Unknown error.');
        q.reject(e);
      });
    } else {
      q.reject('Output path doesn\'t exist');
    }
  });
};

function extractTarGZ(path, outpath, q) {
  isThere(outpath, function(exists) {
    if (exists) {
      try {
        tarball.extractTarball(path, outpath, function(err) {
          if (err)
            return q.reject(err);
          return q.resolve(outpath);
        });
      } catch (err) {
        q.reject(err);
      }
    } else {
      q.reject('Output path doesn\'t exist');
    }
  });
};

function extractGZ(path, outpath, q) {
  var pieces = path.split('/');
  var out = pieces[pieces.length - 1].slice(0, pieces[pieces.length - 1].length - 3); // Single files with regular extension prior to .gz

  isThere(outpath, function(exists) {
    if (exists) {
      fs.createReadStream(path).pipe(zlib.createGunzip().on('error', function(e) {
        q.reject(e);
      })).pipe(fs.createWriteStream(outpath + out).on('finish', function(e) {
        q.resolve(outpath);
      }).on('error', function(e) {
        q.reject(e);
      }));
    } else {
      q.reject('Output path doesn\'t exist');
    }
  });
};

exports.unpackFile = function(path, outpath) {
  if (!isThere(path)) {
    throw null;
  }
  var deferred = Q.defer();
  if (!outpath) {
    deferred.reject('No output path given');
  } else {
    if (outpath[outpath.length - 1] !== '/')
      outpath += '/';
    async.series([
      function(cb) {
        isThere(path, function(exists) {
          return exists
            ? cb()
            : cb('Input file not found');
        });
      },
      function(cb) {
        fs.access(outpath, fs.R_OK | fs.W_OK, function(err) {
          if (err)
            return cb('Cannot write in output folder');
          return cb();
        });
      },
      function(cb) {
        if (/(tar|tar\.gz|tgz)$/i.test(path)) {
          extractTarGZ(path, outpath, deferred);
        } else if (/(gz)$/i.test(path)) {
          extractGZ(path, outpath, deferred);
        } else if (/(zip|rar|7z|zipx|cbz|cbr)$/i.test(path)) {
          extract7Zip(path, outpath, deferred);
        } else {
          return cb('File type not supported');
        }
        return cb();
      }
    ], function(err, results) {
      if (err) {
        deferred.reject(err);
      }
    });
  }

  return deferred.promise;
};
