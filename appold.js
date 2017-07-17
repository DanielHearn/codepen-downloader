const express = require('express')
const app = express()

var http = require('http');
var fs = require('fs');
var download = require('download')
var rimraf = require('rimraf');
var async = require('async');
var EasyZip = require('easy-zip').EasyZip;

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

  var username = req.query.username;
  var apiHostname = "cpv2api.com"
  var apiUrl =  "/pens/public/" + username;


  async.series([
      function (callback) {

        var penList = [];
        var fetchingPens = true;
        var penPage = 1;

        const currOptions = {
          hostname: apiHostname,
          path: apiUrl,
          method: 'GET'
        };
        console.log("Starting search");

        async.whilst(
            function () { return penPage < 100; },
            //function () { return fetchingPens == true; },
            function (callback) {
              currOptions.path = apiUrl + "?page=" + penPage;
              //console.log("Fetch = " + fetchingPens);
              //console.log(currOptions.path);
              https.get(currOptions, function (res) {
                  var json = '';
                  res.on('data', function (chunk) {
                      json += chunk;
                  });
                  res.on('end', function () {
                      if (res.statusCode === 200) {
                          try {
                              var data = JSON.parse(json);
                              if (data.error == "Error. No Pens.") {
                                //console.log("Ran out of pens");
                                //console.log("Fetch = false");
                                fetchingPens = false;
                                penPage = 101;
                              } else if (data == undefined) {
                                console.log("Data undefined");
                              } else {
                                for(var i = 0; i < data.data.length; i++) {
                                   console.log(data.data[i].id);
                                   penList.push(data.data[i].id);
                                }
                                //async.series([
                                //]);
                                //penPage++;
                              }
                              //console.log(data);
                              //console.log(data.success);
                          } catch (e) {
                              console.log('Error after retrieving pens: ' + e);
                          }
                      } else {
                          console.log('Status:', res.statusCode);
                      }
                  });
              }).on('error', function (err) {
                console.log('Error:', err);
              });
              penPage++;
              //callback(null, fetchingPens);
              callback(null, penPage);
            },
            function (err, n) {
              console.log("--");
              //setTimeout(function(){ downloadPens(penList, username, apiHostname, apiUrl, resSource) }, 5000);
            }
        );
          callback(null, penList);
      },
      function (callback) {
          console.log('Second Execute.. ');
          callback(null, 'userDependentData');
      }
  ],
  function (err, result) {
      console.log(result);
  });


  /*
  async.series([
      function(callback) {
          getPens(username, apiHostname, apiUrl, res, penList, fetchingPens, penPage);
          callback(null, '---one---');
      },
      function(callback) {
          downloadPens(penList, username, apiHostname, apiUrl, res);
          callback(null, '---two---');
      },
      function(callback) {
          zipFolder(username, res);
          callback(null, '---three---');
      }
  ],
  function(err, results) {
    console.log(results);
  });*/
  //getPens(username, apiHostname, apiUrl, res);
});

function getPens(username, apiHostname, apiUrl, resSource, penList, fetchingPens, penPage) {
  var penList = [];
  const currOptions = {
    hostname: apiHostname,
    path: apiUrl,
    method: 'GET'
  };
  console.log("Starting search");

  async.whilst(
      function () { return penPage < 100; },
      //function () { return fetchingPens == true; },
      function (callback) {
        currOptions.path = apiUrl + "?page=" + penPage;
        //console.log("Fetch = " + fetchingPens);
        //console.log(currOptions.path);
        https.get(currOptions, function (res) {
            var json = '';
            res.on('data', function (chunk) {
                json += chunk;
            });
            res.on('end', function () {
                if (res.statusCode === 200) {
                    try {
                        var data = JSON.parse(json);
                        if (data.error == "Error. No Pens.") {
                          //console.log("Ran out of pens");
                          //console.log("Fetch = false");
                          fetchingPens = false;
                          penPage = 101;
                        } else if (data == undefined) {
                          console.log("Data undefined");
                        } else {
                          for(var i = 0; i < data.data.length; i++) {
                             console.log(data.data[i].id);
                             penList.push(data.data[i].id);
                          }
                          //async.series([
                          //]);
                          //penPage++;
                        }
                        //console.log(data);
                        //console.log(data.success);
                    } catch (e) {
                        console.log('Error after retrieving pens: ' + e);
                    }
                } else {
                    console.log('Status:', res.statusCode);
                }
            });
        }).on('error', function (err) {
          console.log('Error:', err);
        });
        penPage++;
        //callback(null, fetchingPens);
        callback(null, penPage);
      },
      function (err, n) {
        console.log("--");
        //setTimeout(function(){ downloadPens(penList, username, apiHostname, apiUrl, resSource) }, 5000);
      }
  );
}

function downloadPens(penList, username, apiHostname, apiUrl, resSource) {
  console.log("Pens: " + penList.length);
  console.log("Finished pen search");
  var userDir = __dirname + directory + username + "/";
  try {
    penList.forEach(function (filename, fileIndex) {
      var pen = filename;
      var url = cpUrlStart + username + cpUrlMid + pen;
      download(url, userDir).then(() => {});
    });
  } catch (e) {
    console.log("Download loop error: " + e);
  }
}

function zipFolder(username, resSource) {
  var sourceFolder = __dirname  + "/dist/" + username;
  try {
    var zip = new EasyZip();
    zip.zipFolder(sourceFolder, function(err) {
        if (err) return console.log(err);
        try {
          zip.writeToResponse(resSource, username);
          setTimeout(function(){
              rimraf(__dirname + directory + username + "/", function(error) {
                      console.log('Rimraf error: ' + error);
          });},5000);
        } catch (e) {
          console.log('Rimraf error: ' + e);
        }
    });
    console.log("Finished zipping");
  } catch (e) {
    console.log("Zip error");
  }
}

app.listen(8080, function () {
  console.log('Codepen Downloader listening on port 8080!')
});

module.exports = app;
