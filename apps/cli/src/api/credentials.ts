import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

const CredentialsSchema = z
  .object({
    accessToken: z.string().min(1),
    apiServer: z.string().url(),
    clientId: z.string().min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type Credentials = z.infer<typeof CredentialsSchema>;

export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  const configHome = env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "peated", "credentials.json");
}

export async function loadCredentials(
  path = credentialsPath(),
): Promise<Credentials | null> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error(`Invalid Peated credentials file: ${path}`);
  }

  const parsed = CredentialsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid Peated credentials file: ${path}`);
  }
  return parsed.data;
}

export async function saveCredentials(
  credentials: Credentials,
  path = credentialsPath(),
): Promise<void> {
  const parsed = CredentialsSchema.parse(credentials);
  const directory = dirname(path);
  const temporaryPath = `${path}.${process.pid}.tmp`;

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

export async function deleteCredentials(
  path = credentialsPath(),
): Promise<boolean> {
  try {
    await rm(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function credentialsExpired(
  credentials: Credentials,
  now = Date.now(),
): boolean {
  return Date.parse(credentials.expiresAt) <= now;
}
