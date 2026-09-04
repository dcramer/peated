import program from "@peated/cli/program";
import { runLocalScrapeSourcePreview } from "@peated/server/scraper/localPreview";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const PreviewFileSchema = z
  .object({
    listUrl: z.url(),
    rulesVersion: z.number().int().positive().default(1),
    rules: z.json(),
  })
  .strict();

type PreviewFileInput = z.input<typeof PreviewFileSchema>;

export function parsePreviewInput(value: PreviewFileInput) {
  return PreviewFileSchema.parse(value);
}

export function parsePreviewLimit(value: string) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 99) {
    throw new Error("Preview limit must be an integer from 1 to 99.");
  }
  return limit;
}

async function readPreviewFile(path: string) {
  const contents = await readFile(path, "utf8");
  try {
    return parsePreviewInput(JSON.parse(contents));
  } catch {
    throw new Error(`Invalid scraper preview file: ${path}`);
  }
}

const subcommand = program
  .command("scrapers")
  .description("Test scraper parsing rules through the local runtime");

subcommand
  .command("preview")
  .description("Preview saved parsing rules without writing products")
  .requiredOption("--site <key>", "Existing code-owned external site key")
  .requiredOption("--input <file>", "JSON file containing listUrl and rules")
  .option(
    "--limit <count>",
    "Read at most this many detail pages",
    parsePreviewLimit,
  )
  .action(async (options) => {
    const input = await readPreviewFile(options.input);
    const result = await runLocalScrapeSourcePreview(
      {
        site: options.site,
        ...input,
        limit: options.limit,
      },
      {
        onDeferred: (nextAttemptAt) => {
          console.error(
            `Request controls paused the preview. Continuing after ${nextAttemptAt.toISOString()}.`,
          );
        },
      },
    );
    console.log(JSON.stringify(result, null, 2));
  });
