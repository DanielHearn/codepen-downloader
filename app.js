const express = require('express');
const app = express();

var http = require('http');
var fs = require('fs');
var download = require('download');
var rimraf = require('rimraf');
var async = require('async');

var archiver = require('archiver-promise');

const request = require('request-promise');

var path = require('path');
var router = express.Router();

const cpUrlStart = "https://codepen.io/";
const cpUrlMid = "/share/zip/";
var directory = "/dist/";

const https = require('https');

if (!fs.existsSync("dist")){
    fs.mkdirSync("dist");
}
if (!fs.existsSync("zipped")){
    fs.mkdirSync("zipped");
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(router);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.render('index');
});

app.get('/download', function (req, res) {
  console.log("/download request");
  var username = req.query.username;
  if(username != null) {
    var options = {
        url: 'http://cpv2api.com/pens/public/' + username,
        json: true
    };
    request.get(options).then(function(body) {
      if(body.success == 'true') {
        downloadPenList(username, res);
      } else {
        var errMessage = "Error no pens found";
        console.log(errMessage);
        res.writeHead(400, errMessage, {'content-type' : 'text/plain'});
        res.end(errMessage);
      }
    });

    } else {
      console.log("Error invalid username");
      res.send("Error invalid username");
      res.statusMessage = "rror invalid username";
      res.status(400).end();
    }

});

function downloadPenList(username, res) {
  var options = {
      url: 'http://cpv2api.com/pens/public/' + username,
  };

  var penID = 0;
  var fetchingPens = true;
  var penJsonList = [];

  async.whilst(
      function() { return fetchingPens == true; },
      function(callback) {
          penID++;
          var currOptions = {
              url: 'http://cpv2api.com/pens/public/' + username + "/?page=" + penID,
              json: true
          };
          //console.log(currOptions.url);
          request.get(currOptions).then(function(body) {
              var pensJson = body.data;
              //console.log("Success: " + body.success);
              if(body.success == 'true') {
                //console.log(pensJson.length);
                for(var i = 0; i < pensJson.length; i++) {
                    if(pensJson[i].id != undefined) {
                      //console.log(pensJson[i].id);
                      penJsonList.push(pensJson[i].id);
                    }
                }
              } else {
                fetchingPens = false;
                console.log("Finished while");
              }
              callback(null, fetchingPens);
          });
      },
      function (err, n) {
        if(penJsonList != null) {
          console.log("Pens: " + penJsonList.length);
          downloadPensLocally(penJsonList, username, res);
        }
      }
  );
}

function downloadPensLocally(penList, username, res){
  var userDir = __dirname + directory + username + "/";
  async.each(penList, function(pen, callback) {
    try {
      var penID = pen;
      var url = cpUrlStart + username + cpUrlMid + penID;
      //console.log(url);
      download(url, userDir).then(() => {
        callback();
      });
    } catch (e) {
      console.log("Download loop error: " + e);
      res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
      res.end(errMessage);
    }
  }, function(err) {
      if( err ) {
        console.log('A file failed to download');
        res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
        res.end(errMessage);
      } else {
        console.log('All files have been downloaded successfully');
        zipPens(userDir, username, res);
      }
  });
  console.log("Finished download");
}

function zipPens(userDir, username, res) {
  console.log("Starting zip");
  console.log(userDir);

  var zipFile = __dirname + "/zipped/" + username + ".zip";

  var output = fs.createWriteStream(zipFile);
  var archive = archiver(zipFile, {
      zlib: { level: 9 },
      store: false
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.log("ENOENT");
    } else {
        console.log(err);
        throw err;
    }
  });

  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');

    res.sendFile(zipFile, function(err){
      console.log("Sent file");
      if ( err) {
        console.log('Download err: ' + err);
      }
      removePenDirectory(userDir, username, zipFile, res);
      res.end();
    });

  });

  archive.on('error', function(err) {
    console.log(err);
  });
  archive.pipe(output);
  archive.directory(userDir, false);
  archive.finalize().then(function(){
    console.log('Finished zip');
  });
}

function removePenDirectory(userDir, username, zipFile, res) {
  rimraf(__dirname + directory + username + "/", function(err) {
    if ( err) {
      console.log('Rimraf error when removing pen directory: ' + error);
    }
  });
  fs.unlink(zipFile, (err) => {
    if (err) throw err;
    console.log('Successfully deleted zip');
  });
}

app.listen(process.env.PORT || 8080, function () {
  console.log('Downpen listening on port 8080!')
});

module.exports = app;
