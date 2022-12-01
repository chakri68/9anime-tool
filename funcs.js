import { Browser } from "puppeteer-core";

import randomUseragent from "random-useragent";

//Enable stealth mode
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const m3u8Matcher =
  /https:\/\/a-c-[0-9].dayimage.net\/_v[0-9]\/.*\/master.m3u8/;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36";

const exePath =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : process.platform === "linux"
    ? "/usr/bin/google-chrome"
    : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function startChrome(dev = false) {
  puppeteer.use(StealthPlugin());
  let launchOptions = {
    // devtools: dev,
    // headless: !dev,
    executablePath: exePath, // because we are using puppeteer-core so we must define this option
    args: [
      "--start-maximized",
      "--disable-site-isolation-trials",
      "--disable-features=site-per-process",
      "--process-per-site",
      "--process-per-site",
    ],
  };

  const browser = await puppeteer.launch(launchOptions);

  return browser;
}
/**
 * @param  {Browser} browser
 */
export async function stopChrome(browser) {
  browser.close();
}

// export async function getChromeVersion() {
//   // set some options (set headless to false so we can see
//   // this automated browsing experience)

//   const page = await browser.newPage();

//   // set viewport and user agent (just in case for nice viewing)
//   await page.setViewport({ width: 1366, height: 768 });
//   // await page.setUserAgent(
//   //   "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
//   // );

//   // go to the target web
//   await page.goto("https://example.com");

//   console.log(await browser.version());

//   // close the browser
//   await browser.close();
// }
/**
 * @param  {Browser} browser
 * @param  {String} link
 */
export async function openPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  return page;
}

export async function createPage(browser) {
  //Randomize User agent or Set a valid one
  const userAgent = randomUseragent.getRandom();
  console.log({ userAgent });
  const UA = userAgent || USER_AGENT;
  const page = await browser.newPage();

  //Randomize viewport size
  await page.setViewport({
    width: 1920 + Math.floor(Math.random() * 100),
    height: 3000 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  });

  await page.setUserAgent(UA);
  await page.setJavaScriptEnabled(true);
  await page.setDefaultNavigationTimeout(0);

  //Skip images/styles/fonts loading for performance
  // await page.setRequestInterception(true);
  // page.on("request", (req) => {
  //   if (m3u8Matcher.test(req.url())) {
  //     console.log({ req });
  //   }
  //   if (
  //     req.resourceType() == "stylesheet" ||
  //     req.resourceType() == "font" ||
  //     req.resourceType() == "image"
  //   ) {
  //     req.abort();
  //   } else {
  //     req.continue();
  //   }
  // });

  await page.evaluateOnNewDocument(() => {
    // Pass webdriver check
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  await page.evaluateOnNewDocument(() => {
    // Pass chrome check
    window.chrome = {
      runtime: {},
      // etc.
    };
  });

  await page.evaluateOnNewDocument(() => {
    //Pass notifications check
    const originalQuery = window.navigator.permissions.query;
    return (window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters));
  });

  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, "plugins", {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5],
    });
  });

  await page.evaluateOnNewDocument(() => {
    // Overwrite the `languages` property to use a custom getter.
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  return page;

  // await Promise.all([
  //   page.goto(url, { waitUntil: "load" }),
  //   // page.waitForResponse((response) => m3u8Matcher.test(response.url())),
  // ]);
  // return { page, res };
}
