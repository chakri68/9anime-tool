import { execSync, exec } from "child_process";
import { unlink } from "fs";
import util from "util";
const asyncExec = util.promisify(exec);

export function syncConvertToMkv(inp, out = "./output.mkv") {
  execSync(
    `ffmpeg -v quiet -stats -protocol_whitelist file,http,https,tcp,tls,crypto -i "${inp}" -codec copy "${out}"`,
    { stdio: "inherit" }
  );
}
export async function asyncConvertToMkv(inp, out = "./output.mkv") {
  const { stdout, stderr } = await asyncExec(
    `ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -i "${inp}" -codec copy "${out}"`
  );
  // console.log("stdout:", stdout);
  // console.log("stderr:", stderr);
  return { stdout, stderr };
}

export function syncAddSubtitles(
  inpMov,
  inpSubtitles,
  outputMov = "final.mkv",
  cleanup = true
) {
  execSync(
    `ffmpeg -i ${inpMov} -i ${inpSubtitles} \
  -map 0:v -map 0:a -map 1 \
  -metadata:s:s:0 language=eng \
  -c:v copy -c:a copy -c:s srt \
  ${outputMov}`,
    { stdio: "inherit" }
  );
  if (cleanup) {
    unlink(inpMov, (err) => {
      if (err) console.log(err);
    });
    unlink(inpSubtitles, (err) => {
      if (err) console.log(err);
    });
  }
}
