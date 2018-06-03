#!/usr/bin/env node

const request = require('request-promise')
const async2 = require('async')
const cheerio = require('cheerio')
const download = require('download')
const dateFormat = require('dateformat')
const fs = require('fs')
const siteUrl = 'https://codepen.io/'
const shareUrl = '/share/zip/'
const urlPattern = new RegExp('[^/]+(?=/$|$)')
const args = process.argv.slice(2)
const formattedDate = dateFormat('isoDate')
let username = null
let userDir = null
let unvalidatedPens = []

if (args.length === 1) {
  username = args[0]
  userDir = `downloaded/${username}/${formattedDate}/`
  console.log(`Check if ${username} exists`)
  getUserPage(username)
}

async function getUserPage () {
  var options = {
    url: 'http://cpv2api.com/pens/public/' + username,
    json: true,
    headers: {
      'Accept': 'application/json',
      'Accept-Charset': 'utf-8'
    }
  }

  request.get(options).then(async function (firstPenPage) {
    if (firstPenPage.success === 'true') {
      console.log(`Pens for ${username} exists`)
      await checkFolderExists('downloaded')
      await checkFolderExists(`downloaded/${username}`)
      await checkFolderExists(`downloaded/${username}/${formattedDate}`)
      downloadPenList()
    } else {
      const errMessage = 'Error no pens found'
      console.log(errMessage)
    }
  })
}

function checkFolderExists (dir) {
  if (fs.existsSync(dir)) {
    return true
  } else {
    makeFolder(dir)
    return true
  }
}

function makeFolder (dir) {
  fs.mkdirSync(dir)
}

function downloadPenList () {
  let penID = 0
  let fetchingPens = true
  let penList = []
  console.log('Fetching pens')
  async2.whilst(
    function () { return fetchingPens === true },
    function (callback) {
      penID++
      const url = siteUrl + '/' + username + '/pens/public/grid/' + penID + '/?grid_type=list'
      try {
        request(url, function (err, response, body) {
          if (err) {
            console.log(err)
          }
          const $ = cheerio.load(JSON.parse(body).page.html)
          const $pens = $('.item-in-list-view')
          const data = []

          async2.each($pens, function (pen, callb) {
            const $pen = $(pen)
            const $link = $pen.find('.title a')
            let id = $link.attr('href')
            let name = $link.html()
            name = name.trim()
            name = name.replace(/ /g, '_')
            name = name.replace(/([^a-z0-9 ]+)/gi, '-')
            id = urlPattern.exec(id)
            id = id[0]
            name = name + '_' + id
            data.push({
              id: id
            })
            penList.push({
              id: id,
              name: name
            })
          })
          if (data.length === 0) {
            fetchingPens = false
            console.log('Finished pen search')
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
        console.log('Pens: ' + penList.length)
        downloadPens(penList)
      }
    }
  )
}

async function downloadPens (penList) {
  const promises = await penList.map(downloadPen)
  await Promise.all(promises)
}

function downloadPen (pen) {
  try {
    const penID = pen.id
    const url = siteUrl + username + shareUrl + penID
    download(url).then(data => {
      fs.writeFileSync(`${userDir}/${pen.name}.zip`, data)
    }, function (err) {
      console.log('Download error: ' + err)
      unvalidatedPens.push(pen)
      console.log(unvalidatedPens.length)
    })
  } catch (err) {
    console.log(err)
  }
}
