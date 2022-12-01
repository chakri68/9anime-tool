import { execSync, exec } from "child_process";
import util from "util";
const asyncExec = util.promisify(exec);

export function syncConvertToMkv(inp, out = "./output.mkv") {
  execSync(
    `ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -i "${inp}" -codec copy "${out}"`
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
