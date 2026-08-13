import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  credentialsExpired,
  deleteCredentials,
  loadCredentials,
  saveCredentials,
  type Credentials,
} from "./credentials";

const credentials: Credentials = {
  accessToken: "secret-token",
  apiServer: "https://api.peated.com",
  clientId: "peated-cli",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

const temporaryDirectories: string[] = [];

async function temporaryCredentialsPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "peated-cli-test-"));
  temporaryDirectories.push(directory);
  return join(directory, "config", "credentials.json");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Peated CLI credentials", () => {
  test("stores, loads, and deletes a private credential file", async () => {
    const path = await temporaryCredentialsPath();

    await saveCredentials(credentials, path);

    expect(await loadCredentials(path)).toEqual(credentials);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await deleteCredentials(path)).toBe(true);
    expect(await deleteCredentials(path)).toBe(false);
    expect(await loadCredentials(path)).toBeNull();
  });

  test("rejects malformed durable credentials", async () => {
    const path = await temporaryCredentialsPath();
    await saveCredentials(credentials, path);
    await writeFile(path, JSON.stringify({ ...credentials, extra: true }));

    await expect(loadCredentials(path)).rejects.toThrow(
      `Invalid Peated credentials file: ${path}`,
    );
  });

  test("checks the stored expiration boundary", () => {
    const expiration = Date.parse(credentials.expiresAt);
    expect(credentialsExpired(credentials, expiration - 1)).toBe(false);
    expect(credentialsExpired(credentials, expiration)).toBe(true);
  });
});
