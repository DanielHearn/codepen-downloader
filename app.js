const request = require('request-promise')
const async = require('async')
const cheerio = require('cheerio')
const download = require('download')
const dateFormat = require('dateformat')

const siteUrl = 'https://codepen.io/'
const shareUrl = '/share/zip/'
const urlPattern = new RegExp('[^/]+(?=/$|$)')
const args = process.argv.slice(2)

if (args.length === 1) {
  const username = args[0]

  console.log(`Check if ${username} exists`)
  getUserPage(username)
}

function getUserPage (username) {
  var options = {
    url: 'http://cpv2api.com/pens/public/' + username,
    json: true,
    headers: {
      'Accept': 'application/json',
      'Accept-Charset': 'utf-8'
    }
  }

  request.get(options).then(function (firstPenPage) {
    if (firstPenPage.success === 'true') {
      console.log(`Pens for ${username} exists`)
      downloadPenList(username)
    } else {
      const errMessage = 'Error no pens found'
      console.log(errMessage)
    }
  })
}

function downloadPenList (username) {
  let penID = 0
  let fetchingPens = true
  let penJsonList = []
  let penValidationList = []
  const formattedDate = dateFormat('isoDate')
  const userDir = `downloaded/${username}/${formattedDate}/`
  console.log('Fetching pens')
  async.whilst(
    function () { return fetchingPens === true },
    function (callback) {
      penID++
      const url = siteUrl + '/' + username + '/pens/public/grid/' + penID + '/?grid_type=list'
      // console.log(url)
      try {
        request(url, function (err, response, body) {
          if (err) {
            console.log(err)
          }
          const $ = cheerio.load(JSON.parse(body).page.html)
          const $pens = $('.item-in-list-view')
          const data = []

          async.each($pens, function (pen, callb) {
            const $pen = $(pen)
            const $link = $pen.find('.title a')
            let id = $link.attr('href')
            id = urlPattern.exec(id)
            id = id[0]
            data.push({
              id: id
            })
            penJsonList.push(id)
            try {
              const url = siteUrl + username + shareUrl + id
              // console.log(url)
              download(url, userDir).then(() => {
                callb()
              }, function (err) {
                console.log('Download error: ' + err)
                callb()
              })
            } catch (err) {
              console.log(err)
              callb()
            }
          })
          if (data.length === 0) {
            fetchingPens = false
            console.log('Finished while')
          }
          callback(null, fetchingPens)
        }, function (err) {
          console.log(err)
        })
      } catch (e) {
        throw e
      }
    },
    function (err, n) {
      if (err) {
        console.log(err)
      } else {
        console.log('Pens: ' + penJsonList.length)
      }
    }
  )
}
