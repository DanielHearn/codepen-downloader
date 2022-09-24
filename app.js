#!/usr/bin/env node

import dateFormat from "dateformat";
import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';

const siteUrl = 'https://codepen.io/';
const urlPattern = new RegExp('[^/]+(?=/$|$)');
const args = process.argv.slice(2);
const formattedDate = dateFormat('isoDate');

let username = null;
let password = null;
let userDir = null;
let browser = null;
let page = null;
let downloadedPens = [];
let erroredPens = [];

initialize()

async function initialize () {
  console.log('Running downpen downloader')
  if (args.length === 2) {
    username = args[0];
    password = args[1];
    userDir = `./downloaded/${username}/${formattedDate}/`;
    console.log(`Check if Codepen '${username}' exists`);
    console.log('A chromium browser will open during the download process')
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
    });
    page = await browser.newPage();
    page.setDefaultTimeout(10000)

    const userPage = getUserPageUrl(username)
    const userExists = await checkUserPage(userPage);
    if (!userExists) {
      console.error(`Username ${username} does not exist on Codepen`);
      await browser.close();
      return false;
    }
    console.log(`Username ${username} exists`)

    const loggedIn = await login(username, password)
    if (!loggedIn) {
      console.error(`Failed to login as ${username}`);
      await browser.close();
      return false;
    }
    console.log(`Logged in as ${username}`)
    await page.goto(userPage, {
      waitUntil: 'networkidle2',
    });
    await downloadPens(username)
    //await browser.close();
  } else {
    console.error('Missing Codepen username, email, password within arguments');
    return false;
  }
}

function getUserPageUrl (username) {
  return `${siteUrl}${username}/pens/public?grid_type=list`;
}

async function checkUserPage (userPageUrl) {
  await page.goto(userPageUrl, {
    waitUntil: 'networkidle2',
  });
  const exists = await page.$eval('.profile-grid-pens', () => true).catch(() => false);
  return exists;
}

async function login () {
  await page.goto('https://codepen.io/login', {
    waitUntil: 'networkidle2',
  });
  const emailSelector = '#login-email-field'
  const passSelector = '#login-password-field'
  await page.waitForSelector(emailSelector)
  await page.focus(emailSelector)
  await page.keyboard.type(username)
  await page.focus(passSelector)
  await page.keyboard.type(password)
  await page.click('#log-in-button')
  await page.waitForTimeout(5000);
  await page.waitForSelector('.logged-in')
  return true;
}

async function checkFolderExists (dir) {
  try {
    if (fs.existsSync(dir)) {
      return true
    } else {
      makeFolder(dir)
      return true
    }
  } catch (e) {
    makeFolder(dir)
    return true
  }
}

async function makeFolder (dir) {
  fs.mkdirSync(dir)
}

async function initializeFolders () {
  await checkFolderExists('downloaded')
  await checkFolderExists(`downloaded/${username}`)
  await checkFolderExists(userDir)
}

async function downloadPens () {
  await initializeFolders()
  await page.waitForTimeout(5000);
  let nextPageAvailable = true;
  let pageNumber = 1;
  while(nextPageAvailable) {
    console.log(`Downloading from page ${pageNumber}`);
    nextPageAvailable = await page.$eval('[data-direction="next"]', () => true).catch(() => false);
    const elements = await page.$$(".profile-grid-pens tr .title a");
    const links = []
    for (const element of elements) {
      const link = await (await element.getProperty('href')).jsonValue()
      links.push(link)
    }

    console.log(`Found ${links.length} pens on page ${pageNumber}`)
    let sequence = Promise.resolve();
    links.forEach(link => {
      sequence = 
        sequence
          .then(() => downloadPen(link)) 
    });

    await sequence;

    if (nextPageAvailable) {
      console.log('Next page available')
      await page.waitForTimeout(2000);
      await page.click('[data-direction="next"]')
      await page.waitForTimeout(2000);
      pageNumber++
    } else {
      console.log('Finished downloading, no more pages available')
    }
  }
}

async function downloadPen (url) {
  try {
    console.log(`Attempting download for: ${url}`)
    const penPage = await browser.newPage();
    penPage.setDefaultTimeout(10000)
    const client = await penPage.target().createCDPSession(); 
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      userDataDir: './',
      downloadPath: path.resolve(userDir)
    });
    await penPage.goto(url, {
      waitUntil: 'networkidle2',
    });
    const linkHandlers = await penPage.$x("//button[contains(text(), 'Export')]");
    if (linkHandlers.length > 0) {
      await linkHandlers[0].click();
      await penPage.click('[data-test-id="export-zip"]')
      await penPage.waitForTimeout(5000);
      return true
    } else {
      console.log(`No export link for ${url}`)
      return false
    }
  } catch (err) {
    console.log(err)
    return false
  }
}


/*
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
*/