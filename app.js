var https = require('https');
var fs = require('fs');
var download = require('download');
var rimraf = require('rimraf');
var async = require('async');

var compression = require('compression');
var archiver = require('archiver-promise');
const request = require('request-promise');
var dateFormat = require('dateformat');

var cheerio = require('cheerio');

var path = require('path');

const siteUrl = "https://codepen.io/";
const shareUrl = "/share/zip/";
var dist = "/dist/";
var urlPattern = new RegExp("[^/]+(?=/$|$)");

if (!fs.existsSync("dist")){
    fs.mkdirSync("dist");
}
if (!fs.existsSync("zipped")){
    fs.mkdirSync("zipped");
}

const cluster = require('cluster');

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  const numCPUs = require('os').cpus().length;
  //const numCPUs = 2;
  //cluster.fork();

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log('Worker %d died :(', worker.id);
    cluster.fork();
  });

} else {

  const express = require('express');
  const app = express();
  var router = express.Router();

  app.use(compression());
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'pug');

  app.use(router);
  app.use(express.static(path.join(__dirname, 'public')));

	var allowCrossDomain = function(req, res, next) {
			res.header('Access-Control-Allow-Origin', '*');
			res.header('Access-Control-Allow-Methods', 'GET');
			res.header('Access-Control-Allow-Headers', 'Content-Type, X-XSRF-TOKEN');
			next();
	}
	app.use(allowCrossDomain);

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.get('/download', function (req, res) {
    console.log("/download request");
    var username = req.query.username;
    var formattedDate = dateFormat('isoDate');
    var userDir = __dirname + dist + formattedDate + "-" + username + "/";
    var zipFile = __dirname + "/zipped/" + formattedDate + "-" + username + ".zip";

    if(username !== null) {

      var options = {
        url: 'http://cpv2api.com/pens/public/' + username,
        json: true,
        headers: {
          'Accept': 'application/json',
          'Accept-Charset': 'utf-8',
        }
      }

      request.get(options).then(function(firstPenPage) {
        if(firstPenPage.success == 'true') {
          downloadPenList(username, userDir, zipFile, res);
        } else {
          var errMessage = "Error no pens found";
          res.writeHead(400, errMessage, {'content-type' : 'text/plain'});
          res.end(errMessage);
        }
      });

      } else {
        //console.log("Error invalid username");
        res.writeHead(400, "Error invalid username", {'content-type' : 'text/plain'});
        res.end("Error invalid username");
      }
  });

  function downloadPenList(username, userDir, zipFile, res) {

    var penID = 0;
    var fetchingPens = true;
    var penJsonList = [];

    //setTimeout(requestTimeout, 100000, userDir, zipFile, res);

    console.log("Fetching pens");
    async.whilst(
        function() { return fetchingPens == true; },
        function(callback) {
            penID++;
            var url = siteUrl + '/'+username+'/pens/public/grid/' + penID + '/?grid_type=list';
            //console.log(url);
            try {
              request(url, function(err, response, body){
          			if(err){
          				res.send({ error: "Hmm, error occured try again" }); // lol...
          			}
            		var $ = cheerio.load(JSON.parse(body).page.html);
            		var $pens = $('.item-in-list-view');
            		var data = [];

            		$pens.each(function(){
            			var $pen = $(this);
            			var $link = $pen.find('.title a');
            			var id = $link.attr('href');
            			id = urlPattern.exec(id);
            			id = id[0];
            			data.push({
            				id: id,
            			});
                  //penUrl = siteUrl + username + shareUrl + id;
                  penJsonList.push(id);
            		});
                if (data.length == 0) {
                  fetchingPens = false;
                  console.log("Finished while");
                }
                callback(null, fetchingPens);
                //console.log(data);
              });
            } catch (e) {
              throw e;
            }
        },
        function (err, n) {
          if(err) {
            removePenDirectory(userDir, zipFile, res);
          } else {
            console.log("Pens: " + penJsonList.length);
            downloadPensLocally(penJsonList, username, userDir, zipFile, res);
          }
        }
    );
  }

  function requestTimeout(username, userDir, zipFile, res) {
    async.series([
      function(callback) {
        removePenDirectory(userDir, zipFile, res);
        callback(null, "1");
      },
      function(callback) {
        try {
          removePenDirectory(userDir, zipFile, userDir, res);
          res.writeHead(400, "Error request timeout, maybe too may pens :(", {'content-type' : 'text/plain'});
          res.end("Error request timeout, maybe too may pens :(");
          callback(null, "2");
        } catch (err) {
          removePenDirectory(userDir, zipFile, userDir, res);
          console.log("Request timeout error: " + err);
        }
      }

    ],
    function(err, results) {
      console.log("Timeout handled");
    });
  }

  function downloadPensLocally(penList, username, userDir, zipFile, res){
    console.log("Downloading Pens");
    var pensDownloaded = 0;
    var penValidationList = [];

    /*
    Promise.all(penList.map(penUrl => download(penUrl, userDir)))
    .then(function (text) { // (A)
      console.log('All files have been downloaded successfully');
      console.log("Total: " + penList.length);
      zipPens(userDir, username, res);
    })
    .catch(function (error) { // (B)
      console.error('An error occurred', error);
    });*/

    async.each(penList, function(pen, callback) {
      try {
        var penID = pen;
        var url = siteUrl + username + shareUrl + penID;

        download(url, userDir).then(() => {
          penValidationList.push(penID);
          callback();
        }, function(err) {
          //res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
          //res.end("Pen processing error");
          //removePenDirectory(userDir, zipFile, userDir, res);
          console.log("Download error: " + err);
          //res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
          //res.end("Pen processing error");
          callback();
        });
      } catch (e) {
        //console.log("Download loop error: " + e);
        /*try {
          removePenDirectory(userDir, zipFile, userDir, res);
          res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
          res.end("Pen processing error");
        } catch (err) {
          removePenDirectory(userDir, zipFile, userDir, res);
          console.log("Downloading pen: " + err);
          res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
          res.end("Pen processing error");
        }*/
      }
    }, function(err) {
        if( err ) {
          removePenDirectory(userDir, zipFile, userDir, res);
          console.log('A file failed to download');
          res.writeHead(400, "Pen processing error", {'content-type' : 'text/plain'});
          res.end("Pen processing error");
        } else {
          console.log('All files have been downloaded successfully');
          console.log("Validated: " + penValidationList.length + ", total: " + penList.length);
          setTimeout(function(){ zipPens(userDir, username, userDir, zipFile, res);}, 1000);
        }
    });


  }

  function zipPens(userDir, username, userDir, zipFile, res) {
    console.log("Starting zip");

    var output = fs.createWriteStream(zipFile);
    var zip = archiver(zipFile, {
        zlib: { level: 9 },
        store: false
    });

    try {
      zip.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            //console.log("ENOENT");
        } else {
            //console.log(err);
            removePenDirectory(userDir, zipFile, userDir, res);
        }
        res.end();
      });

      output.on('close', function() {
        //console.log(zip.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');

        res.sendFile(zipFile, function(err){
          console.log("Sent file");
          if ( err) {
            console.log('Download err: ' + err);
          }
          removePenDirectory(userDir, zipFile, userDir, res);
          res.end();
        });

      });

      zip.on('error', function(err) {
        console.log(err);
      });
      zip.pipe(output);
      zip.directory(userDir, false);
      zip.finalize().then(function(){
        console.log('Finished zip');
      });
    } catch (err) {
      console.log("Zip err: " + err);
    }
  }

  function removePenDirectory(userDir, zipFile, userDir, res) {
    try {
      if (fs.existsSync(userDir)){
        rimraf(userDir, function(err) {
          if ( err) {
            console.log('Rimraf error when removing pen directory: ' + error);
          }
        });
      }
      if (fs.existsSync(zipFile)){
        fs.unlink(zipFile, (err) => {
          if (err) throw err;
          console.log('Successfully deleted zip');
        });
      }
    } catch (err) {
      console.log("Remove directory err: " + err);
    }
  }

  app.listen(process.env.PORT || 8080, function () {
    console.log('Downpen listening on port 8080!')
  });

  module.exports = app;

  console.log(`Worker ${process.pid} started`);
}
