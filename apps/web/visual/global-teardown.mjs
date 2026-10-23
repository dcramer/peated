import fs from "node:fs/promises";
import path from "node:path";

// Snapshot locks live under `.metadata`. Remove them so only PNGs are saved.
export default async function globalTeardown() {
  const output = process.env.VISUAL_OUTPUT_DIR
    ? path.resolve(process.env.VISUAL_OUTPUT_DIR)
    : path.resolve(".playwright/visual");
  await fs.rm(path.join(output, ".metadata"), { force: true, recursive: true });
}
