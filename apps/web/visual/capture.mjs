import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import { sealData } from "iron-session";

import { testAccessToken, testUser } from "../e2e/rpc-fixtures.mjs";
import { getScenarios } from "./scenarios/index.mjs";
import { selectScenarioIds } from "./select-scenarios.mjs";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_OUT_DIR = path.join(WEB_ROOT, ".playwright/visual");
const SESSION_SECRET =
  "peated-playwright-session-secret-for-local-browser-tests";

function requireFlagValue(flag, value) {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a non-empty value`);
  }
  return value;
}

function parseArgs(argv) {
  let all = false;
  let changedFile;
  let outDir = DEFAULT_OUT_DIR;
  let scenarioList;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--changed-file") {
      changedFile = requireFlagValue(arg, argv[++index]);
      continue;
    }
    if (arg === "--out-dir") {
      const value = requireFlagValue(arg, argv[++index]);
      outDir = path.isAbsolute(value) ? value : path.resolve(WEB_ROOT, value);
      continue;
    }
    if (arg === "--scenarios") {
      scenarioList = requireFlagValue(arg, argv[++index]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { all, changedFile, outDir, scenarioList };
}

async function readChangedPaths(changedFile) {
  if (!changedFile) return [];
  return (await fs.readFile(changedFile, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function startProcess(command, args, env) {
  const child = spawn(command, args, {
    cwd: WEB_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(`Could not start ${command}:`, error);
  });
  return child;
}

async function waitForUrl(url, children, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Server stopped before ${url} was ready`);
      }
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

async function startServers() {
  const apiPort = Number(process.env.VISUAL_API_PORT ?? 4999);
  const webPort = Number(process.env.VISUAL_WEB_PORT ?? 3200);
  const apiServer = `http://127.0.0.1:${apiPort}`;
  const baseURL = `http://127.0.0.1:${webPort}`;
  const api = startProcess(process.execPath, ["e2e/mock-rpc-server.mjs"], {
    PLAYWRIGHT_API_PORT: String(apiPort),
  });
  const web = startProcess(
    "pnpm",
    ["exec", "next", "dev", "-p", String(webPort)],
    {
      API_SERVER: apiServer,
      SESSION_SECRET,
      URL_PREFIX: baseURL,
    },
  );

  try {
    await Promise.all([
      waitForUrl(`${apiServer}/health`, [api], 30_000),
      waitForUrl(`${baseURL}/browser-not-supported`, [web], 120_000),
    ]);
  } catch (error) {
    await Promise.all([stopProcess(web), stopProcess(api)]);
    throw error;
  }

  return {
    baseURL,
    close: () => Promise.all([stopProcess(web), stopProcess(api)]),
  };
}

async function createContext(browser, baseURL, scenario, viewport) {
  const context = await browser.newContext({
    baseURL,
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
    viewport: { height: viewport.height, width: viewport.width },
  });

  if (scenario.signedIn) {
    const value = await sealData(
      { accessToken: testAccessToken, ts: Date.now(), user: testUser },
      { password: SESSION_SECRET, ttl: 60 * 60 * 24 * 7 },
    );
    await context.addCookies([
      {
        domain: "127.0.0.1",
        httpOnly: true,
        name: "_session",
        path: "/",
        sameSite: "Lax",
        value,
      },
    ]);
  }

  return context;
}

async function captureScenario({ baseURL, browser, outDir, scenario }) {
  const screenshots = [];
  for (const viewport of scenario.viewports) {
    const context = await createContext(browser, baseURL, scenario, viewport);
    const page = await context.newPage();
    try {
      await page.goto(scenario.path, {
        timeout: 60_000,
        waitUntil: "networkidle",
      });
      await page
        .getByRole("heading", { exact: true, name: scenario.heading })
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });
      await page.evaluate(async () => document.fonts.ready);
      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });

      const file = `${scenario.id}__${viewport.name}.png`;
      await page.screenshot({
        animations: "disabled",
        caret: "hide",
        fullPage: true,
        path: path.join(outDir, file),
        type: "png",
      });
      screenshots.push({ file, label: `${scenario.label} · ${viewport.name}` });
    } finally {
      await context.close();
    }
  }
  return screenshots;
}

async function main() {
  const { all, changedFile, outDir, scenarioList } = parseArgs(
    process.argv.slice(2),
  );
  const changedFiles = await readChangedPaths(changedFile);
  const sourceSha =
    process.env.VISUAL_SOURCE_SHA ?? process.env.GITHUB_SHA ?? null;
  const selection = all ? "all" : scenarioList ? "named" : "changed-files";
  const scenarioIds = all
    ? selectScenarioIds(changedFiles, { all: true })
    : scenarioList
      ? scenarioList
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : selectScenarioIds(changedFiles);

  await fs.rm(outDir, { force: true, recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  if (scenarioIds.length === 0) {
    await writeManifest(outDir, {
      changedFiles: changedFiles.slice(0, 20),
      commitSha: sourceSha,
      scenarioIds,
      screenshots: [],
      selection,
      skipped: true,
    });
    console.log("screenshot capture skipped: no matching pages");
    return;
  }

  const scenarios = getScenarios(scenarioIds);
  const servers = await startServers();
  let browser;
  const screenshots = [];
  try {
    browser = await chromium.launch({ headless: true });
    for (const scenario of scenarios) {
      screenshots.push(
        ...(await captureScenario({
          baseURL: servers.baseURL,
          browser,
          outDir,
          scenario,
        })),
      );
    }
  } finally {
    await browser?.close();
    await servers.close();
  }

  await writeManifest(outDir, {
    changedFiles: changedFiles.slice(0, 20),
    commitSha: sourceSha,
    scenarioIds,
    screenshots,
    selection,
    skipped: false,
  });
  console.log(
    `screenshot capture wrote ${screenshots.length} image(s) for ${scenarioIds.join(", ")}`,
  );
}

async function writeManifest(outDir, manifest) {
  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
