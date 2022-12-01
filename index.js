#!/usr/bin/env node

import { writeFileSync } from "fs";

import chalk from "chalk";
import inquirer from "inquirer";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import request_client from "request-promise-native";
import { sleep } from "./utils.js";
import { createPage, openPage, startChrome } from "./funcs.js";
import {
  syncConvertToMkv,
  asyncConvertToMkv,
  syncAddSubtitles,
} from "./ffmeg.js";

const limitResults = 5;

let spinner;
const m3u8Matcher =
  /https:\/\/a-c-[0-9].dayimage.net\/_v[0-9]\/.*\/master.m3u8/;

const subtitlesMatcher = /https:\/\/.*eng-[0-9].vtt/;

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

spinner.start({ text: "Searching for episodes..." });

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
let subtitles;

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
        spinner.update({ text: "STREAM FOUND! Continuing..." });
        anime_9_player.removeListener("request", requestHandler);
        await anime_9_player.close();
      } else if (subtitlesMatcher.test(request_url)) {
        subtitles = {
          request_url,
          request_headers,
          request_post_data,
          response_headers,
          response_size,
          response_body,
        };
        spinner.update({ text: "SUBTITLES FOUND! Continuing..." });
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

await Promise.all([
  anime_9_player.goto(`https://9anime.vc${results[anime_selection]}`, {
    waitUntil: "domcontentloaded",
  }),
  anime_9_player.waitForSelector(
    "section.block_area-episodes > div.block_area-content"
  ),
]);

let episodeData = await anime_9_player.evaluate(() => {
  let results = {};
  let eps, headerEps;
  // let headerEps = document.querySelectorAll(
  //   ".block_area-episodes .block_area-header-tabs ul.ranges li.ep-page-item"
  // );
  if (!headerEps) {
    eps = document.querySelectorAll(
      ".block_area-episodes .block_area-content .episodes-ul a"
    );
  }
  if (headerEps) {
    results["count"] = parseInt(
      Array.from(headerEps)[headerEps.length - 1].textContent.split("-").pop()
    );
  } else if (eps) {
    Array.from(eps).map((aEl) => {
      console.log(aEl.dataset.id);
      results[aEl.dataset.number] = aEl.dataset.id;
    });
  }
  return results;
});

if (episodeData) {
  spinner.success({ text: "Episodes found!" });
} else {
  spinner.error({ text: "Something went wrong..." });
  process.exit(1);
}

let epNumSelection = await inquirer.prompt({
  name: "episode_number",
  type: "number",
  message: `Episode to download (1-${Object.keys(episodeData).length})`,
  default() {
    return "1";
  },
});

let { episode_number } = epNumSelection;

spinner.start({ text: `Getting the stream for episode ${episode_number}` });

await anime_9_player.setRequestInterception(true);

anime_9_player.on("request", requestHandler);
anime_9_player.goto(
  `https://9anime.vc${results[anime_selection]}?ep=${episodeData[episode_number]}`,
  {
    waitUntil: "load",
  }
);

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

// try {
//   let { stdout, stderr } = await asyncConvertToMkv(resm3u8.request_url);
// } catch (error) {
//   spinner.error({ text: "Download failed..." });
//   process.exit(1);
// }

// Write to a subtitle file if subtitles are found
if (subtitles) writeFileSync("subtitles.vtt", subtitles.response_body);
// Download the video
try {
  syncConvertToMkv(resm3u8.request_url);
  if (subtitles) syncAddSubtitles("output.mkv", "subtitles.vtt");
} catch (error) {
  console.error(error);
  spinner.error({ text: "Download failed..." });
  process.exit(1);
}

spinner.success({ text: "Downloaded the episode successfully." });
process.exit(0);
