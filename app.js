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
  downloadPenList(username, res);
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
          //downloadPenList(penJsonList, username, res);
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
    }
  }, function(err) {
      if( err ) {
        console.log('A file failed to download');
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

  var output = fs.createWriteStream(__dirname + '/zipped/' + username + '.zip');
  var archive = archiver('zip', {
      zlib: { level: 9 },
      store: true
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
    res.download(zipFile, username + ".zip", function(err){
      removePenDirectory(userDir, username, zipFile);
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

function removePenDirectory(userDir, username, zipFile) {
  rimraf(__dirname + directory + username + "/", function(err) {
    if ( err) {
      console.log('Rimraf error when removing pen directory: ' + error);
    }
  });
  fs.unlink(zipFile, (err) => {
    if (err) throw err;
    console.log('Successfully deleted zip');
  });
  res.end();
}

app.listen(process.env.PORT || 8080, function () {
  console.log('Codepen Downloader listening on port 8080!')
});

module.exports = app;
