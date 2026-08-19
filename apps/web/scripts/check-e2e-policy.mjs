import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_SCHEDULED_TESTS = 80;
const CI_GLOBAL_TIMEOUT_MS = 7 * 60_000;
const CI_TEST_TIMEOUT_MS = 45_000;
const CI_MAX_FAILURES = 2;
const CI_RETRIES = 1;

const playwrightCli = fileURLToPath(
  import.meta.resolve("@playwright/test/cli"),
);
const webRoot = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  process.execPath,
  [playwrightCli, "test", "--list", "--reporter=json"],
  {
    cwd: webRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
  },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  process.exit(result.status ?? 1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(result.stderr);
  throw new Error("Playwright did not return a valid JSON test list.", {
    cause: error,
  });
}

const specs = collectSpecs(report.suites);
const scheduledTests = specs.flatMap((spec) =>
  spec.tests.map((test) => ({ spec, test })),
);
const errors = [];

if (scheduledTests.length > MAX_SCHEDULED_TESTS) {
  errors.push(
    `The suite schedules ${scheduledTests.length} tests; the policy allows ${MAX_SCHEDULED_TESTS}.`,
  );
}

for (const { spec, test } of scheduledTests) {
  const isMobileProject = test.projectName === "chromium-mobile";
  const isMobileTagged = spec.tags.includes("mobile");

  if (isMobileProject && !isMobileTagged) {
    errors.push(
      `${spec.file}:${spec.line} runs on mobile without the @mobile tag.`,
    );
  }
  if (!isMobileProject && isMobileTagged) {
    errors.push(
      `${spec.file}:${spec.line} has the @mobile tag but runs in ${test.projectName}.`,
    );
  }
}

if (report.config.globalTimeout !== CI_GLOBAL_TIMEOUT_MS) {
  errors.push(`CI globalTimeout must remain ${CI_GLOBAL_TIMEOUT_MS}ms.`);
}
if (report.config.maxFailures !== CI_MAX_FAILURES) {
  errors.push(`CI maxFailures must remain ${CI_MAX_FAILURES}.`);
}

for (const project of report.config.projects) {
  if (project.timeout !== CI_TEST_TIMEOUT_MS) {
    errors.push(
      `${project.name} test timeout must remain ${CI_TEST_TIMEOUT_MS}ms.`,
    );
  }
  if (project.retries !== CI_RETRIES) {
    errors.push(`${project.name} CI retries must remain ${CI_RETRIES}.`);
  }
}

if (errors.length > 0) {
  process.stderr.write("E2E policy failed:\n");
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.stderr.write(
    "Remove duplicate browser coverage or update the documented policy and its budget in the same change.\n",
  );
  process.exit(1);
}

const mobileTests = scheduledTests.filter(
  ({ test }) => test.projectName === "chromium-mobile",
).length;
process.stdout.write(
  `E2E policy passed: ${scheduledTests.length}/${MAX_SCHEDULED_TESTS} scheduled tests; ${mobileTests} mobile-only.\n`,
);

function collectSpecs(suites) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []),
    ...collectSpecs(suite.suites ?? []),
  ]);
}
