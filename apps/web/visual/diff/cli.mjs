#!/usr/bin/env node
import path from "node:path";

import { compareDirectories } from "./compare.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (!["--baseline", "--candidate", "--output"].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith("-")) {
      throw new Error(`${arg} requires a directory`);
    }
    values[arg.slice(2)] = path.resolve(value);
  }

  for (const name of ["baseline", "candidate", "output"]) {
    if (!values[name]) throw new Error(`Missing --${name}`);
  }
  return values;
}

async function main() {
  const report = await compareDirectories(parseArgs(process.argv.slice(2)));
  const changes =
    report.summary.added + report.summary.changed + report.summary.removed;
  console.log(`visual diff found ${changes} change(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
