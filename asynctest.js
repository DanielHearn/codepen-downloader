const express = require('express')
const app = express()

var http = require('http');
var fs = require('fs');
var download = require('download')
var rimraf = require('rimraf');
var async = require('async');
var EasyZip = require('easy-zip').EasyZip;


const request = require('request-promise')

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
  async.waterfall([
      function retrievePens(callback) {
          console.log("--Retrieving Pens--");
          var username = req.query.username;
          var count = 0;
          async.whilst(
              function() { return count < 2; },
              function(callback) {
                  count++;
                  var options = {
                    host: 'cpv2api.com',
                    path: '/pens/public/natewiley'
                  };

                  callback = function(response) {
                    var str = '';

                    //another chunk of data has been recieved, so append it to `str`
                    response.on('data', function (chunk) {
                      str += chunk;
                    });

                    //the whole response has been recieved, so we just print it out here
                    response.on('end', function () {
                      console.log(str);
                      console.log("Finished get");
                      callback(null, res);
                    });
                  }
                  http.request(options, callback).end();
              },
              function (err, n) {
                  console.log("Finished while: " + n);
              }
          );

          console.log("Username: " + username);
          callback(null, username, count);
      },
      function downloadPens(username, count, callback) {
          console.log("--Downloading Pens--");
          console.log("Pens: " + count);
          var codepen = "codepen.io/" + username;
          console.log("Codepen: " + codepen);
          callback(null, codepen);
      },
      function zipPens(codepen, callback) {
          console.log("--Zipping Pens--");
          console.log("Zipped: " + codepen);
          callback(null, codepen);
      }
  ], function (err, result) {
      console.log("Result: " + result);
  });
});

app.listen(8080, function () {
  console.log('Codepen Downloader listening on port 8080!')
});

module.exports = app;
