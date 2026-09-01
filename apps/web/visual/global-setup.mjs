import fs from "node:fs/promises";
import path from "node:path";

export default async function globalSetup() {
  const output = process.env.VISUAL_OUTPUT_DIR
    ? path.resolve(process.env.VISUAL_OUTPUT_DIR)
    : path.resolve(".playwright/visual");

  await fs.rm(output, { force: true, recursive: true });
  await fs.mkdir(output, { recursive: true });
}
