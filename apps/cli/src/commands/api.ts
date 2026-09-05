import program from "@peated/cli/program";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  PeatedApiValueSchema,
  requestPeatedApi,
  type PeatedApiValue,
} from "../api/client";
import {
  credentialsExpired,
  loadCredentials,
  type Credentials,
} from "../api/credentials";

type ApiCommandOptions = {
  input?: string;
  yes?: boolean;
};

type ApiImageUploadOptions = {
  caption?: string;
  file: string;
  idempotencyKey?: string;
  primary?: boolean;
  sourceUrl?: string;
  license?: string;
  yes?: boolean;
};

function imageContentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    default:
      throw new Error(
        "Unsupported image extension. Use .jpg, .jpeg, .png, .webp, .gif, or .avif.",
      );
  }
}

async function requireCredentials(): Promise<Credentials> {
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new Error("Not logged in. Run `pnpm cli auth login` first.");
  }
  if (credentialsExpired(credentials)) {
    throw new Error("Peated login expired. Run `pnpm cli auth login` again.");
  }
  return credentials;
}

async function readInput(
  path: string | undefined,
): Promise<PeatedApiValue | undefined> {
  if (!path) return undefined;

  const contents = await readFile(path, "utf8");
  try {
    return PeatedApiValueSchema.parse(JSON.parse(contents));
  } catch {
    throw new Error(`Invalid JSON input file: ${path}`);
  }
}

async function confirmMutation(method: string, path: string): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `Refusing non-interactive ${method} ${path} without explicit --yes.`,
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await prompt.question(`Send ${method} ${path}? [y/N] `);
    if (answer.trim().toLowerCase() !== "y") {
      throw new Error("API mutation cancelled.");
    }
  } finally {
    prompt.close();
  }
}

async function runApiCommand(
  method: string,
  path: string,
  options: ApiCommandOptions,
): Promise<void> {
  const credentials = await requireCredentials();
  const body = await readInput(options.input);

  if (method !== "GET" && !options.yes) {
    await confirmMutation(method, path);
  }

  const result = await requestPeatedApi({
    ...credentials,
    method,
    path,
    body,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function runImageUploadCommand(
  path: string,
  options: ApiImageUploadOptions,
): Promise<void> {
  const credentials = await requireCredentials();
  if (!options.yes) await confirmMutation("POST", path);

  const contents = await readFile(options.file);
  const body = new FormData();
  body.set(
    "file",
    new File([contents], basename(options.file), {
      type: imageContentType(options.file),
    }),
  );
  if (options.caption !== undefined) body.set("caption", options.caption);
  if (options.sourceUrl !== undefined) {
    body.set("sourceUrl", options.sourceUrl);
  }
  if (options.license !== undefined) body.set("license", options.license);
  if (options.primary !== undefined) {
    body.set("isPrimary", String(options.primary));
  }
  if (options.idempotencyKey !== undefined) {
    body.set("idempotencyKey", options.idempotencyKey);
  }

  const result = await requestPeatedApi({
    ...credentials,
    method: "POST",
    path,
    body,
  });
  console.log(JSON.stringify(result, null, 2));
}

const subcommand = program
  .command("api")
  .description("Make authenticated requests to the Peated API");

subcommand
  .command("get")
  .description("Read a Peated API resource")
  .argument("<path>", "API path, such as /bottles/123")
  .action(async (path) => runApiCommand("GET", path, {}));

subcommand
  .command("upload-image")
  .description("Upload an image to a multipart Peated API endpoint")
  .argument("<path>", "API path, such as /bottles/123/image")
  .requiredOption("--file <path>", "Local image file")
  .option("--caption <caption>", "Image caption")
  .option("--source-url <url>", "Original image source page")
  .option("--license <license>", "Image license or reuse terms")
  .option("--primary", "Make this the primary Entity image")
  .option("--idempotency-key <key>", "Idempotency key for the upload")
  .option("--yes", "Send the mutation without an interactive confirmation")
  .action(async (path, options) => runImageUploadCommand(path, options));

for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
  subcommand
    .command(method.toLowerCase())
    .description(`Send an authenticated ${method} request`)
    .argument("<path>", "API path, such as /bottles/123")
    .option("--input <file>", "Read the JSON request body from a file")
    .option("--yes", "Send the mutation without an interactive confirmation")
    .action(async (path, options) => runApiCommand(method, path, options));
}
