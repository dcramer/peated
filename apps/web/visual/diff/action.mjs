import fs from "node:fs";
import path from "node:path";

import { compareDirectories } from "./compare.mjs";

function input(name) {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  if (!value) throw new Error(`Missing ${name} input`);
  return path.resolve(value);
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

async function main() {
  const report = await compareDirectories({
    baseline: input("baseline"),
    candidate: input("candidate"),
    output: input("output"),
  });
  const changes =
    report.summary.added + report.summary.changed + report.summary.removed;
  output("changes", changes);
  console.log(`visual diff found ${changes} change(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
