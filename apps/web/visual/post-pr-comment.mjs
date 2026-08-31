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

function imageLabels(...manifests) {
  return new Map(
    manifests.flatMap((manifest) =>
      (manifest?.screenshots ?? []).map((screenshot) => [
        screenshot.file,
        String(screenshot.label).replace(/[\r\n[\]()]/g, " "),
      ]),
    ),
  );
}

function validateImagePath(value, prefix = "") {
  if (
    value?.constructor !== String ||
    value.startsWith("/") ||
    value.includes("\\") ||
    path.posix.normalize(value) !== value ||
    value.split("/").includes("..") ||
    !value.endsWith(".png") ||
    (prefix && !value.startsWith(prefix))
  ) {
    throw new Error(`Invalid report image path: ${value}`);
  }
}

export function validateReport(report) {
  if (report?.version !== 1 || !Array.isArray(report.files)) {
    throw new Error("Invalid visual diff report");
  }
  const statuses = new Set(["added", "changed", "removed", "unchanged"]);
  const imageKeys = {
    added: ["candidate"],
    changed: ["baseline", "candidate", "diff"],
    removed: ["baseline"],
    unchanged: [],
  };
  for (const file of report.files) {
    validateImagePath(file.file);
    if (!statuses.has(file.status)) {
      throw new Error(`Invalid visual diff status: ${file.status}`);
    }
    const expectedKeys = imageKeys[file.status];
    const actualKeys =
      file.images?.constructor === Object
        ? Object.keys(file.images).sort((left, right) =>
            left.localeCompare(right),
          )
        : [];
    if (
      (expectedKeys.length === 0 &&
        (file.image !== undefined || file.images !== undefined)) ||
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new Error(`Invalid visual diff images for ${file.status}`);
    }
    for (const key of expectedKeys) {
      validateImagePath(file.images[key], `images/${key}/`);
    }
    if (expectedKeys.length > 0) {
      const primaryKey = file.status === "changed" ? "diff" : expectedKeys[0];
      validateImagePath(file.image, "images/");
      if (file.image !== file.images[primaryKey]) {
        throw new Error(`Invalid visual diff image for ${file.status}`);
      }
    }
  }
  return report;
}

function imageUrl(imageBaseUrl, imagePath) {
  const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
  return `${imageBaseUrl}/${encodedPath}`;
}

function renderChange(screenshot, label, imageBaseUrl) {
  const status =
    screenshot.status[0].toUpperCase() + screenshot.status.slice(1);
  const lines = [`### ${label} — ${status}`, ""];

  if (screenshot.status === "changed") {
    const before = imageUrl(imageBaseUrl, screenshot.images.baseline);
    const after = imageUrl(imageBaseUrl, screenshot.images.candidate);
    const diff = imageUrl(imageBaseUrl, screenshot.images.diff);
    lines.push(
      "| Before | After |",
      "| --- | --- |",
      `| ![${label} before](${before}) | ![${label} after](${after}) |`,
      "",
      "<details>",
      "<summary>Pixel diff</summary>",
      "",
      `![${label} pixel diff](${diff})`,
      "",
      "</details>",
      "",
    );
  } else {
    const kind = screenshot.status === "added" ? "candidate" : "baseline";
    const heading = screenshot.status === "added" ? "After" : "Before";
    lines.push(
      `#### ${heading}`,
      "",
      `![${label} ${heading.toLowerCase()}](${imageUrl(imageBaseUrl, screenshot.images[kind])})`,
      "",
    );
  }

  return lines.join("\n");
}

export function buildBody({ baseline, candidate, report }, imageBaseUrl) {
  const manifest = candidate;
  const changedFiles = manifest.changedFiles.length
    ? manifest.changedFiles
        .slice(0, 8)
        .map((file) => `- \`${file}\``)
        .join("\n")
    : "- None provided";
  const labels = imageLabels(baseline, candidate);
  const changes = report.files.filter((file) => file.status !== "unchanged");
  const screenshots = changes
    .map((screenshot) => {
      const label = labels.get(screenshot.file) ?? screenshot.file;
      return renderChange(screenshot, label, imageBaseUrl);
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
    changes.length === 0
      ? "No visual changes in the selected pages."
      : screenshots,
    "_Compared from local Peated with fixed test data. Visual changes do not block the pull request._",
    "",
  ].join("\n");
}

export function shouldPostComment(manifest) {
  return !manifest.skipped && manifest.screenshots.length > 0;
}

function publishImages(reportDir, report, branch, commitSha) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "peated-screenshots-"));
  fs.writeFileSync(
    path.join(tempDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  for (const file of report.files) {
    for (const image of Object.values(file.images ?? {})) {
      const source = path.join(reportDir, ...image.split("/"));
      if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) {
        throw new Error(`Missing report image: ${image}`);
      }
      const destination = path.join(tempDir, ...image.split("/"));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
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
  const candidatePath = path.join(outDir, "candidate/manifest.json");
  const baselinePath = path.join(outDir, "baseline/manifest.json");
  const reportDir = path.join(outDir, "report");
  const reportPath = path.join(reportDir, "report.json");
  for (const file of [baselinePath, candidatePath, reportPath]) {
    if (!fs.existsSync(file))
      throw new Error(`Missing visual result at ${file}`);
  }

  const result = {
    baseline: JSON.parse(fs.readFileSync(baselinePath, "utf8")),
    candidate: JSON.parse(fs.readFileSync(candidatePath, "utf8")),
    report: validateReport(JSON.parse(fs.readFileSync(reportPath, "utf8"))),
  };
  if (!shouldPostComment(result.candidate)) {
    console.log("no screenshot scenarios matched; skipping PR comment");
    return;
  }

  const prNumber = requiredEnv("PR_NUMBER");
  const repo = requiredEnv("GITHUB_REPOSITORY");
  const commitSha = process.env.GITHUB_SHA ?? "unknown";
  const branch = `web-screenshots/pr-${prNumber}`;
  const imageRef = publishImages(reportDir, result.report, branch, commitSha);
  const body = buildBody(
    result,
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
