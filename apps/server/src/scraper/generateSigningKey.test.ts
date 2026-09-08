import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../../scripts/generate-peated-bot-key.mjs", import.meta.url),
);

describe("generate-peated-bot-key", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "peated-bot-key-test-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("creates a private Ed25519 JWK with restrictive permissions", async () => {
    const outputDirectory = join(temporaryDirectory, "private");
    const outputPath = join(outputDirectory, "peated-bot-private.jwk");

    const { stdout } = await execFileAsync(process.execPath, [
      scriptPath,
      outputDirectory,
    ]);

    expect(stdout).toBe(
      `Created ${join(await realpath(outputDirectory), "peated-bot-private.jwk")}\n`,
    );
    const key = JSON.parse(await readFile(outputPath, "utf8"));
    expect(key).toMatchObject({ kty: "OKP", crv: "Ed25519" });
    expect(key.x).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(key.d).toMatch(/^[A-Za-z0-9_-]+$/);
    expect((await stat(outputDirectory)).mode & 0o777).toBe(0o700);
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
  });

  it("does not overwrite an existing key", async () => {
    const outputDirectory = join(temporaryDirectory, "private");
    await execFileAsync(process.execPath, [scriptPath, outputDirectory]);

    await expect(
      execFileAsync(process.execPath, [scriptPath, outputDirectory]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Refusing to overwrite the existing key"),
    });
  });

  it("rejects relative and repository paths", async () => {
    await expect(
      execFileAsync(process.execPath, [scriptPath, "private"]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("must be an absolute path"),
    });
    await expect(
      execFileAsync(process.execPath, [scriptPath, dirname(scriptPath)]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("inside the repository"),
    });
  });
});
