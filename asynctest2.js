const express = require('express')
const app = express()

var http = require('http');
var fs = require('fs');
var download = require('download');
var rimraf = require('rimraf');
var async = require('async');


//var EasyZip = require('easy-zip').EasyZip;
//var archiver = require('archiver');
var archiver = require('archiver-promise');

const request = require('request-promise');

var path = require('path');
var router = express.Router();

const cpUrlStart = "https://codepen.io/";
const cpUrlMid = "/share/zip/";
var directory = "/dist/";
//var filename = "sss" + ".zip";

const https = require('https');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(router);
app.use(express.static(path.join(__dirname, 'public')));

//rimraf(__dirname + '/dist', function () { console.log('Cleared dist'); });

app.get('/', function (req, res) {
  res.render('index');
});

app.get('/download', function (req, res) {
  console.log("/");

  var username = req.query.username;

  var options = {
      url: 'http://cpv2api.com/pens/public/' + username,
  };

  request.get(options).then(function(body) {
      var Pensjson = JSON.parse(body);
      downloadPenList(Pensjson, username, res);
  });
});

function downloadPenList(Pensjson, username, res) {
  var penList = [];
  async.each(Pensjson, function(pen, callback) {
    if (pen.error == "Error. No Pens.") {
      callback();
    } else if (pen == undefined) {
      console.log("Data undefined");
    } else {
      for(var i = 0; i < pen.length; i++) {
          if(pen[i].id != undefined) {
            //console.log(pen[i].id);
            penList.push(pen[i].id);
          }
      }
      callback();
    }
  }, function(err) {
      if( err ) {
        console.log('A pen failed to be found');
      } else {
        console.log('All pens found successfully');
        console.log(penList);
      }
  });
  console.log("Finished searching");
  downloadPensLocally(penList, username, res);
}

function downloadPensLocally(penList, username, res){
  var userDir = __dirname + directory + username + "/";
  async.each(penList, function(pen, callback) {
    try {
      var penID = pen;
      var url = cpUrlStart + username + cpUrlMid + penID;
      console.log(url);
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
        //setTimeout(function(){
        zipPens(userDir, username, res);
        //},200);
      }
  });
  console.log("Finished download");
}

function zipPens(userDir, username, res) {
  console.log("Starting zip");
  console.log(userDir);

  var archiver = require('archiver');

  // create a file to stream archive data to.
  var output = fs.createWriteStream(__dirname + '/zipped/' + username + '.zip');
  var archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
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

  // listen for all archive data to be written
  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
    setTimeout(function(){
        res.download(__dirname + "/zipped/" + username + ".zip", username + ".zip");
        removePenDirectory(userDir, username);
    },200);
  });

  archive.on('error', function(err) {
    console.log(err);
  });
  archive.pipe(output);
  archive.directory(userDir, false);
  archive.finalize().then(function(){
    console.log('Finished zip');
  });
  /*
  zip.zipFolder(userDir, function(err) {
      if (err) return console.log(err);
      try {
        zip.writeToFile("zipped/" + username + ".zip");
      } catch (e) {
        console.log('Rimraf error: ' + e);
      }
      console.log("Finished zipping");
  }, function(err) {
      if( err ) {
        console.log('A file failed to zip');
      } else {
        console.log('All files have been zipped successfully');
        setTimeout(function(){
            res.download(__dirname + "/zipped/" + username + ".zip", username + ".zip");
            removePenDirectory(userDir, username);
        },200);
      }
  });*/
}

function removePenDirectory(userDir, username) {
  setTimeout(function(){
      rimraf(__dirname + directory + username + "/", function(err) {
      if ( err) {
        console.log('Rimraf error when removing pen directory: ' + error);
      }
  });},1000);
}

app.listen(8080, function () {
  console.log('Codepen Downloader listening on port 8080!')
});

module.exports = app;
