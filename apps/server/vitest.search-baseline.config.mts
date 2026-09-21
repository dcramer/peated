import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";
import config from "./vitest.config.mts";

// Compare the actual pre-change routes and ranker, not a rewritten SQL baseline.
// Keep current schema/serializers so both runs use the same fixture graph.
const revision = "923f1eca87c741839d1603081f464e4abeba847e";
const root = fileURLToPath(new URL("../../", import.meta.url));
const paths = [
  "apps/server/src/orpc/routes/bottles/create-candidates.ts",
  "apps/server/src/orpc/routes/bottles/list.ts",
  "apps/server/src/orpc/routes/search.ts",
  "apps/server/src/lib/bottleCreateCandidates.ts",
  "apps/server/src/lib/search.ts",
];
const sources = new Map(
  paths.map((path) => {
    let source = execFileSync("git", ["show", `${revision}:${path}`], {
      cwd: root,
      encoding: "utf8",
    });
    if (path.endsWith("/lib/search.ts")) {
      // The current fixture writes new text columns. The old implementation
      // never reads them; this adapter leaves its GIN document untouched.
      source += `\nexport function buildBottleSearchDocuments() {
        return { searchNames: "", searchTerms: "" };
      }\n`;
    }
    return [
      fileURLToPath(new URL(path, new URL("../../", import.meta.url))),
      source,
    ];
  }),
);

export default mergeConfig(config, {
  plugins: [
    {
      name: "peated-search-before-change",
      enforce: "pre",
      load(id) {
        return sources.get(id.split("?")[0]) ?? null;
      },
    },
  ],
});
