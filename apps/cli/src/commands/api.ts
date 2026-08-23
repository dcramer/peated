import program from "@peated/cli/program";
import { readFile } from "node:fs/promises";
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

const subcommand = program
  .command("api")
  .description("Make authenticated requests to the Peated JSON API");

subcommand
  .command("get")
  .description("Read a Peated API resource")
  .argument("<path>", "API path, such as /bottles/123")
  .action(async (path) => runApiCommand("GET", path, {}));

for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
  subcommand
    .command(method.toLowerCase())
    .description(`Send an authenticated ${method} request`)
    .argument("<path>", "API path, such as /bottles/123")
    .option("--input <file>", "Read the JSON request body from a file")
    .option("--yes", "Send the mutation without an interactive confirmation")
    .action(async (path, options) => runApiCommand(method, path, options));
}
