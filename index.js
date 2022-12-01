#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import request_client from "request-promise-native";
import { sleep } from "./utils.js";
import { createPage, openPage, startChrome } from "./funcs.js";
import { syncConvertToMkv, asyncConvertToMkv } from "./ffmeg.js";

const limitResults = 5;

let spinner;
const m3u8Matcher =
  /https:\/\/a-c-[0-9].dayimage.net\/_v[0-9]\/.*\/master.m3u8/;

const rainbowTitle = chalkAnimation.rainbow("9Anime CLI! \n");

const browser = await startChrome(true);

rainbowTitle.stop();

console.log(`
    ${chalk.bgBlue("HOW TO USE THE CLI")} 
    Follow the directions given.
  `);

let answers = await inquirer.prompt({
  name: "anime_name",
  type: "input",
  message: "What's the name of the anime",
  default() {
    return "Attack on titan";
  },
});

let { anime_name } = answers;

spinner = createSpinner("Searching...").start();

let anime_9_page = await openPage(browser);

await anime_9_page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
);

await anime_9_page.goto(
  `https://9anime.vc/search?keyword=${anime_name.split(" ").join("+")}`,
  { waitUntil: "domcontentloaded" }
);

let results = await anime_9_page.evaluate((limitResults) => {
  let results = {};
  let res = document.querySelectorAll("div.flw-item.item-qtip");
  Array.from(res)
    .slice(0, res.length < limitResults ? res.length : limitResults)
    .map((el) => {
      let linkNode = el.querySelector(".film-detail .film-name a");
      results[linkNode.textContent] = linkNode.getAttribute("href");
    });
  return results;
}, limitResults);

if (Object.keys(results).length == 0) {
  spinner.error({ text: "No Anime with the specified name found..." });
}

spinner.success({ text: "Anime found..." });

await anime_9_page.close();

const anime_selection_input = await inquirer.prompt({
  name: "anime_selection",
  type: "list",
  message: "Search results",
  choices: Object.keys(results),
});

let { anime_selection } = anime_selection_input;

spinner = createSpinner("Opening...").start();

// await anime_9_page.goto(
//   `https://9anime.vc${results[anime_selection]}`
//   // {
//   //   waitUntil: "domcontentloaded",
//   // }
// );

// let request = await anime_9_page.waitForRequest((request) =>
//   m3u8Matcher.test(request.url())
// );

let anime_9_player = await createPage(browser);
let resm3u8;

function requestHandler(request) {
  request_client({
    uri: request.url(),
    followAllRedirects: true,
    resolveWithFullResponse: true,
  })
    .then(async (response) => {
      const request_url = request.url();
      const request_headers = request.headers();
      const request_post_data = request.postData();
      const response_headers = response.headers;
      const response_size = response_headers["content-length"];
      const response_type = response_headers["content-type"];
      const response_body = response.body;
      if (m3u8Matcher.test(request_url)) {
        resm3u8 = {
          request_url,
          request_headers,
          request_post_data,
          response_headers,
          response_size,
          response_body,
        };
        console.log("STREAM FOUND!");
        anime_9_player.removeListener("request", requestHandler);
        await anime_9_player.close();
      }
      if (
        request.resourceType() == "stylesheet" ||
        request.resourceType() == "font"
      ) {
        request.abort();
      } else if (
        request.isNavigationRequest() &&
        request.redirectChain().length !== 0
      ) {
        request.abort();
      } else {
        request.continue();
      }
      // console.log(response_type);
    })
    .catch((error) => {
      // console.error(error);
      request.abort();
    });
}

await anime_9_player.setRequestInterception(true);

anime_9_player.on("request", requestHandler);

await anime_9_player.goto(`https://9anime.vc${results[anime_selection]}`, {
  waitUntil: "load",
});

if (!resm3u8) await sleep(30000);
anime_9_player.removeListener("request", requestHandler);

if (resm3u8) spinner.success({ text: "Success!" });
else {
  spinner.error({
    text: "Something went wrong. Please try running the command again..",
  });
  process.exit(1);
}

spinner.start({ text: "Downloading the file..." });

try {
  let { stdout, stderr } = await asyncConvertToMkv(resm3u8.request_url);
} catch (error) {
  spinner.error({ text: "Download failed..." });
  process.exit(1);
}

spinner.success({ text: "Downloaded the episode successfully." });
process.exit(0);
