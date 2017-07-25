var http = require('http');
var fs = require('fs');
var download = require('download');
var rimraf = require('rimraf');
var async = require('async');

var compression = require('compression');
var archiver = require('archiver-promise');
const request = require('request-promise');

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
          downloadPenList(username, res);
        } else {
          var errMessage = "Error no pens found";
          res.writeHead(400, errMessage, {'content-type' : 'text/plain'});
          res.end(errMessage);
        }
      });

      } else {
        //console.log("Error invalid username");
        res.send("Error invalid username");
        res.statusMessage = "Error invalid username";
        res.status(400).end();
      }

  });

  function downloadPenList(username, res) {

    var penID = 0;
    var fetchingPens = true;
    var penJsonList = [];

    console.log("Fetching pens");
    async.whilst(
        function() { return fetchingPens == true; },
        function(callback) {
            penID++;

            var url = siteUrl + '/'+username+'/pens/public/grid/' + penID + '/?grid_type=list';
            console.log(url);
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
            removePenDirectory(username, zipFile, res);
          } else {
            console.log("Pens: " + penJsonList.length);
            downloadPensLocally(penJsonList, username, res);
          }
        }
    );
  }

  function requestTimeout(username, res) {
    async.series([
    function(callback) {
      removePenDirectory(username, "noZip", res);
      callback(null);
    },
    function(callback) {
        res.statusMessage = "Error request timeout, maybe too may pens :(";
        res.status(400).end();
        callback(null);
    }
    ],
    function(err) {
      console.log("Timeout handled");
    });
  }

  function downloadPensLocally(penList, username, res){
    var userDir = __dirname + dist + username + "/";
    console.log("Downloading Pens");
    var pensDownloaded = 0;

    async.each(penList, function(pen, callback) {
      try {
        var penID = pen;
        var url = siteUrl + username + shareUrl + penID;
        ////console.log(url);
        download(url, userDir).then(() => {
          callback();
        });
      } catch (e) {
        //console.log("Download loop error: " + e);
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
  }

  function zipPens(userDir, username, res) {
    console.log("Starting zip");

    var zipFile = __dirname + "/zipped/" + username + ".zip";

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
            removePenDirectory(username, zipFile, res);
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
          removePenDirectory(username, zipFile, res);
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
    } catch (e) {
      throw e;
    }
  }

  function removePenDirectory(username, zipFile, res) {
    try {
      rimraf(__dirname + dist + username + "/", function(err) {
        if ( err) {
          console.log('Rimraf error when removing pen directory: ' + error);
        }
      });
      if(zipFile != "noZip") {
        fs.unlink(zipFile, (err) => {
          if (err) throw err;
          console.log('Successfully deleted zip');
        });
      }
    } catch (e) {
      throw e;
    }
  }

  app.listen(process.env.PORT || 8080, function () {
    console.log('Downpen listening on port 8080!')
  });

  module.exports = app;

  console.log(`Worker ${process.pid} started`);
}
