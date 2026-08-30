#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "<!-- peated-web-screenshots -->";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function ghJson(args) {
  return JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}

function ghInput(args, body) {
  execFileSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    input: body,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: process.env,
    stdio: options.stdio ?? "inherit",
  });
}

export function buildBody(manifest, imageBaseUrl) {
  if (manifest.skipped || manifest.screenshots.length === 0) {
    return [
      MARKER,
      "## Web screenshots",
      "",
      "_No screenshot scenarios match these changed files._",
      "",
    ].join("\n");
  }

  const changedFiles = manifest.changedFiles.length
    ? manifest.changedFiles
        .slice(0, 8)
        .map((file) => `- \`${file}\``)
        .join("\n")
    : "- None provided";
  const screenshots = manifest.screenshots
    .map((screenshot) => {
      const url = `${imageBaseUrl}/${screenshot.file}`;
      return [
        `### ${screenshot.label}`,
        "",
        `![${screenshot.label}](${url})`,
        "",
      ].join("\n");
    })
    .join("\n");
  const run =
    manifest.selection === "all"
      ? "Run: all pages (`run-all-screenshots` or `--all`)"
      : manifest.selection === "named"
        ? "Run: pages named by the command"
        : "Run: pages matched to changed files";

  return [
    MARKER,
    "## Web screenshots",
    "",
    run,
    `Pages: \`${manifest.scenarioIds.join("`, `")}\``,
    "",
    "Changed files:",
    changedFiles,
    "",
    screenshots,
    "_Captured from local Peated with fixed test data. These images help review a change. They do not compare pixels or block a pull request because the page changed._",
    "",
  ].join("\n");
}

function publishImages(outDir, branch, commitSha) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "peated-screenshots-"));
  for (const file of fs.readdirSync(outDir)) {
    if (file.endsWith(".png") || file === "manifest.json") {
      fs.copyFileSync(path.join(outDir, file), path.join(tempDir, file));
    }
  }

  git(["init", "-q"], { cwd: tempDir });
  git(["checkout", "--orphan", branch], { cwd: tempDir });
  git(["add", "."], { cwd: tempDir });
  git(
    [
      "-c",
      "user.name=peated-screenshots",
      "-c",
      "user.email=peated-screenshots@users.noreply.github.com",
      "commit",
      "-m",
      `web screenshots ${commitSha}`,
    ],
    { cwd: tempDir },
  );
  const publishedSha = git(["rev-parse", "HEAD"], {
    cwd: tempDir,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const remote = `https://x-access-token:${requiredEnv("GITHUB_TOKEN")}@github.com/${requiredEnv("GITHUB_REPOSITORY")}.git`;
  git(["remote", "add", "origin", remote], { cwd: tempDir });
  git(["push", "-f", "origin", `HEAD:${branch}`], { cwd: tempDir });
  fs.rmSync(tempDir, { force: true, recursive: true });
  return publishedSha;
}

function upsertComment(repo, prNumber, body) {
  const comments = ghJson([
    "api",
    `repos/${repo}/issues/${prNumber}/comments`,
    "--paginate",
    "--slurp",
  ]).flat();
  const existing = comments.find((comment) => comment.body?.includes(MARKER));
  const payload = JSON.stringify({ body });

  if (existing) {
    ghInput(
      [
        "api",
        "-X",
        "PATCH",
        `repos/${repo}/issues/comments/${existing.id}`,
        "--input",
        "-",
      ],
      payload,
    );
    return;
  }
  ghInput(
    [
      "api",
      "-X",
      "POST",
      `repos/${repo}/issues/${prNumber}/comments`,
      "--input",
      "-",
    ],
    payload,
  );
}

function main() {
  const outDir = path.resolve(process.argv[2] ?? "apps/web/.playwright/visual");
  const prNumber = requiredEnv("PR_NUMBER");
  const repo = requiredEnv("GITHUB_REPOSITORY");
  const commitSha = process.env.GITHUB_SHA ?? "unknown";
  const branch = `web-screenshots/pr-${prNumber}`;
  const manifestPath = path.join(outDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest at ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const hasScreenshots = !manifest.skipped && manifest.screenshots.length > 0;
  const imageRef = hasScreenshots
    ? publishImages(outDir, branch, commitSha)
    : branch;
  const body = buildBody(
    manifest,
    `https://raw.githubusercontent.com/${repo}/${imageRef}`,
  );
  upsertComment(repo, prNumber, body);
  console.log(`updated screenshot comment on PR #${prNumber}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
