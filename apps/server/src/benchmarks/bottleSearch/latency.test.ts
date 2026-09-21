import config from "@peated/server/config";
import { routerClient } from "@peated/server/orpc/router";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const output = process.env.BOTTLE_SEARCH_TIMING_OUTPUT;

// Opt-in timing experiment: ordinary CI should not assert wall-clock budgets.
// Use the normal integration database, never a production connection.
test.skipIf(!output)(
  "measures warm Bottle routes outside fixture setup",
  async ({ fixtures }) => {
    const original = config.BOTTLE_SEARCH_TIN;
    config.BOTTLE_SEARCH_TIN = false;
    try {
      const brand = await fixtures.Entity({ name: "Timing Producer" });
      for (let index = 0; index < 1000; index++) {
        await fixtures.Bottle({
          name: "Harbor Reserve",
          edition: `Release ${index}`,
          brandId: brand.id,
          statedAge: 10 + (index % 30),
          abv: 40 + (index % 20),
          totalTastings: index % 100,
        });
      }
      await fixtures.Bottle({ name: "Rare Orchard", brandId: brand.id });
      const cases = [
        {
          name: "selective candidate search",
          run: () =>
            routerClient.bottles.createCandidates({ name: "Rare Orchard" }),
          expectedCount: 1,
        },
        {
          name: "broad candidate search",
          run: () =>
            routerClient.bottles.createCandidates({ name: "Harbor Reserve" }),
          expectedCount: 3,
        },
        {
          name: "producer and release facts",
          run: () =>
            routerClient.bottles.createCandidates({
              name: "Harbor Reserve",
              brand: { id: brand.id, name: brand.name },
              statedAge: 20,
              abv: 50,
            }),
          expectedCount: 3,
        },
        {
          name: "no candidate match",
          run: () =>
            routerClient.bottles.createCandidates({ name: "Missing Orchard" }),
          expectedCount: 0,
        },
        {
          name: "100-result Bottle list",
          run: () => routerClient.bottles.list({ query: "Harbor", limit: 100 }),
          expectedCount: 100,
        },
      ];
      const timings: number[][] = cases.map(() => []);
      for (let round = 0; round < 55; round++) {
        for (let offset = 0; offset < cases.length; offset++) {
          const index = (round + offset) % cases.length;
          const start = performance.now();
          const result = await cases[index].run();
          const elapsed = performance.now() - start;
          if (result.results.length !== cases[index].expectedCount) {
            throw new Error(
              `Unexpected result count for ${cases[index].name}: ${result.results.length}`,
            );
          }
          if (round >= 5) timings[index].push(elapsed);
        }
      }
      await writeFile(
        output!,
        JSON.stringify(
          {
            corpus:
              "1,001 synthetic Bottles; one producer; warm serial requests",
            boundary:
              "In-process route, validation, PostgreSQL, ranking and serialization; excludes HTTP and fixture setup",
            engine: "GIN",
            cases: cases.map((entry, index) => {
              const values = timings[index].sort((a, b) => a - b);
              return {
                name: entry.name,
                samples: values.length,
                p50Ms: values[Math.ceil(values.length * 0.5) - 1],
                p95Ms: values[Math.ceil(values.length * 0.95) - 1],
                maxMs: values.at(-1),
              };
            }),
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      config.BOTTLE_SEARCH_TIN = original;
    }
  },
  120_000,
);
