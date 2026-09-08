import program from "@peated/cli/program";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createInterface } from "node:readline/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
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
  concurrency?: string;
  from?: string;
  input?: string;
  yes?: boolean;
};

const ApiBatchRequestSchema = z
  .object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z
      .string()
      .startsWith("/")
      .refine((path) => !path.startsWith("//"), "Path cannot start with //"),
    body: PeatedApiValueSchema.optional(),
    expect: z.record(z.string(), PeatedApiValueSchema).optional(),
    select: z.array(z.string().min(1)).min(1).max(20).optional(),
  })
  .strict();

const ApiBatchInputSchema = z.array(ApiBatchRequestSchema).min(1).max(500);
const ApiObjectSchema = z.record(z.string(), PeatedApiValueSchema);

export class ApiBatchRequestError extends Error {
  constructor(
    readonly requestIndex: number,
    readonly requestMethod: string,
    readonly requestPath: string,
    cause: unknown,
  ) {
    const reason = cause instanceof Error ? `: ${cause.message}` : "";
    super(
      `Request ${requestIndex} failed (${requestMethod} ${requestPath})${reason}`,
      { cause },
    );
  }
}

export function parseApiBatchInput(contents: string) {
  return ApiBatchInputSchema.parse(JSON.parse(contents));
}

export function selectApiResult(result: PeatedApiValue, paths: string[]) {
  return Object.fromEntries(
    paths.map((path) => {
      let selected: PeatedApiValue = result;
      for (const part of path.split(".")) {
        if (Array.isArray(selected)) {
          const index = Number(part);
          if (!Number.isInteger(index) || selected[index] === undefined) {
            throw new Error(`Response does not contain ${path}.`);
          }
          selected = selected[index];
          continue;
        }
        const object = ApiObjectSchema.safeParse(selected);
        if (!object.success || object.data[part] === undefined) {
          throw new Error(`Response does not contain ${path}.`);
        }
        selected = object.data[part];
      }
      return [path, selected];
    }),
  );
}

export function verifyApiResult(
  result: PeatedApiValue,
  expected: Record<string, PeatedApiValue>,
) {
  const object = ApiObjectSchema.safeParse(result);
  if (!object.success) {
    throw new Error("Response must be an object.");
  }
  for (const [key, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(object.data[key], value)) {
      throw new Error(
        `Response did not match ${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(object.data[key])}.`,
      );
    }
  }
}

export function parseApiBatchStartIndex(
  value: string | undefined,
  requestCount: number,
) {
  const index = Number(value ?? 0);
  if (!Number.isInteger(index) || index < 0 || index >= requestCount) {
    throw new Error(
      `Batch start index must be between 0 and ${requestCount - 1}.`,
    );
  }
  return index;
}

export function parseApiBatchConcurrency(value: string | undefined) {
  const concurrency = Number(value ?? 1);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    throw new Error("Batch concurrency must be between 1 and 20.");
  }
  return concurrency;
}

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

async function runApiBatch(
  inputPath: string,
  options: Pick<ApiCommandOptions, "concurrency" | "from" | "yes">,
): Promise<void> {
  const requests = parseApiBatchInput(await readFile(inputPath, "utf8"));
  const from = parseApiBatchStartIndex(options.from, requests.length);
  const selectedRequests = requests.slice(from);
  const hasMutation = selectedRequests.some(({ method }) => method !== "GET");
  const concurrency = parseApiBatchConcurrency(options.concurrency);
  if (hasMutation && concurrency !== 1) {
    throw new Error("Concurrent batches may contain only GET requests.");
  }
  if (hasMutation && !options.yes) {
    await confirmMutation("BATCH", `${selectedRequests.length} API requests`);
  }

  const credentials = await requireCredentials();
  const runRequest = async (
    request: (typeof selectedRequests)[number],
    index: number,
  ) => {
    try {
      const result = await requestPeatedApi({
        ...credentials,
        method: request.method,
        path: request.path,
        body: request.body,
      });
      if (request.expect) verifyApiResult(result, request.expect);
      return JSON.stringify({
        index,
        method: request.method,
        path: request.path,
        result: request.select
          ? selectApiResult(result, request.select)
          : result,
      });
    } catch (err) {
      throw new ApiBatchRequestError(index, request.method, request.path, err);
    }
  };

  for (
    let offset = 0;
    offset < selectedRequests.length;
    offset += concurrency
  ) {
    const chunk = selectedRequests.slice(offset, offset + concurrency);
    const output = await Promise.all(
      chunk.map((request, chunkOffset) =>
        runRequest(request, from + offset + chunkOffset),
      ),
    );
    for (const line of output) console.log(line);
  }
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

subcommand
  .command("batch")
  .description("Run API requests from a JSON file")
  .requiredOption("--input <file>", "Read a JSON array of API requests")
  .option("--from <index>", "Resume at a zero-based request index")
  .option(
    "--concurrency <count>",
    "Run GET-only requests concurrently (maximum 20)",
    "1",
  )
  .option("--yes", "Send mutations without an interactive confirmation")
  .action(async (options) => runApiBatch(options.input, options));

for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
  subcommand
    .command(method.toLowerCase())
    .description(`Send an authenticated ${method} request`)
    .argument("<path>", "API path, such as /bottles/123")
    .option("--input <file>", "Read the JSON request body from a file")
    .option("--yes", "Send the mutation without an interactive confirmation")
    .action(async (path, options) => runApiCommand(method, path, options));
}
