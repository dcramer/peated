import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import pg from "pg";
import { z } from "zod";
import { CATEGORY_LIST } from "../../constants";
import {
  buildBottleCreateCandidateQueries,
  rankBottleCreateCandidates,
  type BottleCreateCandidateInput,
} from "../../lib/bottleCreateCandidates";
import { bottleTextQuery } from "../../lib/bottleTextSearch";
import { buildBottleSearchVector } from "../../lib/search";
import { searchCases } from "./cases";

const Choice = z.object({ id: z.number(), name: z.string() });
const Row = z.object({
  id: z.number(),
  name: z.string(),
  fullName: z.string(),
  brand: Choice,
  distillers: z.array(Choice),
  bottler: Choice.nullish(),
  series: Choice.nullish(),
  category: z.enum(CATEGORY_LIST).nullish(),
  edition: z.string().nullish(),
  statedAge: z.number().nullish(),
  abv: z.number().nullish(),
  vintageYear: z.number().nullish(),
  bottlingYear: z.number().nullish(),
  releaseYear: z.number().nullish(),
  releaseMonth: z.number().nullish(),
  releaseDay: z.number().nullish(),
  caskNumber: z.string().nullish(),
  maturation: z.string().nullish(),
  outturn: z.number().nullish(),
  singleCask: z.boolean().nullish(),
  caskStrength: z.boolean().nullish(),
  noAgeStatement: z.boolean().nullish(),
  naturalColor: z.boolean().nullish(),
  nonChillFiltered: z.boolean().nullish(),
  totalTastings: z.number().default(0),
  updatedAt: z.string(),
});
type SearchRow = z.infer<typeof Row>;
type Engine = "current-gin" | "structured-gin" | "lead";

const { values } = parseArgs({
  options: {
    corpus: { type: "string" },
    repeats: { type: "string", default: "10" },
    lead: { type: "boolean", default: false },
    crowding: { type: "boolean", default: false },
    split: { type: "string", default: "development" },
  },
});
if (!values.corpus)
  throw new Error("Pass --corpus <JSON array of public Bottle records>.");
const repeats = z.coerce.number().int().min(1).max(100).parse(values.repeats);
const corpus = z
  .array(Row)
  .parse(JSON.parse(await readFile(values.corpus, "utf8")));
if (new Set(corpus.map((b) => b.id)).size !== corpus.length)
  throw new Error("Corpus has duplicate Bottle IDs.");
for (const test of searchCases.filter(
  (test) =>
    values.split === "all" || (test.split ?? "development") === values.split,
)) {
  if (!corpus.some((b) => b.id === test.expected))
    throw new Error(`Missing expected Bottle ${test.expected}: ${test.name}`);
}
const observedCorpusSize = corpus.length;
if (values.crowding) {
  for (let i = 1; i <= 120; i++) {
    corpus.push(
      Row.parse({
        id: -i,
        name: "30-year-old",
        fullName: `Synthetic Brand ${i} 30-year-old`,
        brand: { id: -i, name: `Synthetic Brand ${i}` },
        distillers: [],
        statedAge: 30,
        abv: 46,
        totalTastings: 1_000_000,
        updatedAt: "2026-09-20T00:00:00Z",
      }),
    );
  }
}

// Benchmark owner: keep scratch DDL on the dedicated loopback database. Never
// inherit DATABASE_URL or the production application's environment.
const client = new pg.Client({
  host: "127.0.0.1",
  port: 15433,
  database: "search_benchmark",
  user: "postgres",
  password: "postgres",
  application_name: "peated-search-benchmark",
});
const dialect = new PgDialect();

async function retrieve(engine: Engine, input: BottleCreateCandidateInput) {
  const variants = buildBottleCreateCandidateQueries(input);
  if (!variants.length) return [];
  const params: unknown[] = [variants];
  const textPredicate = `EXISTS (SELECT FROM unnest($1::text[]) AS q WHERE search_vector @@ plainto_tsquery('english', unaccent(q)))`;
  if (engine === "current-gin") {
    const result = await client.query<{ data: SearchRow }>(
      `SELECT data FROM search_benchmark_bottles WHERE ${textPredicate}
       ORDER BY activity DESC, updated_at DESC LIMIT 100`,
      params,
    );
    return result.rows.map((r) => r.data);
  }

  // Independent bounded retrievals keep a wrong draft relationship from
  // excluding a useful text candidate. Every engine uses the existing ranker.
  params.push(
    input.brand?.id ?? null,
    (input.distillers ?? []).flatMap((d) => (d.id ? [d.id] : [])),
    input.caskNumber ?? null,
    input.statedAge ?? null,
    input.vintageYear ?? null,
    input.abv ?? null,
  );
  const identity = `(brand_id = $2 OR distiller_ids && $3::bigint[])`;
  const factScore = `(CASE WHEN data->>'caskNumber' = $4 THEN 8 ELSE 0 END +
    CASE WHEN (data->>'statedAge')::float = $5 THEN 2 ELSE 0 END +
    CASE WHEN (data->>'vintageYear')::float = $6 THEN 3 ELSE 0 END +
    CASE WHEN (data->>'abv')::float = $7 THEN 2 ELSE 0 END)`;
  let textQuery: string;
  if (engine === "lead") {
    params.push(bottleTextQuery(input.name, { any: true }));
    textQuery = `SELECT data FROM search_benchmark_bottles
      WHERE search_text ==> $8 AND cardinality($1::text[]) > 0
      ORDER BY tin.score(ctid) DESC LIMIT 50`;
  } else {
    textQuery = `SELECT data FROM search_benchmark_bottles WHERE ${textPredicate}
      ORDER BY activity DESC, updated_at DESC LIMIT 50`;
  }
  const result = await client.query<{ data: SearchRow }>(
    `WITH text_matches AS MATERIALIZED (${textQuery}),
     identity_matches AS MATERIALIZED (
       SELECT data FROM search_benchmark_bottles WHERE ${identity}
       ORDER BY ${factScore} DESC, id LIMIT 50
     ) SELECT data FROM text_matches UNION ALL SELECT data FROM identity_matches`,
    params,
  );
  return result.rows.map((r) => r.data);
}

await client.connect();
try {
  await client.query("SET statement_timeout = '30s'");
  await client.query("CREATE EXTENSION IF NOT EXISTS unaccent");
  if (values.lead) await client.query("CREATE EXTENSION IF NOT EXISTS tin");
  await client.query("BEGIN");
  await client.query(`CREATE TEMP TABLE search_benchmark_bottles (
    id bigint PRIMARY KEY, brand_id bigint NOT NULL, distiller_ids bigint[] NOT NULL,
    activity bigint NOT NULL, updated_at timestamptz NOT NULL,
    search_vector tsvector NOT NULL, search_text text NOT NULL, data jsonb NOT NULL
  ) ON COMMIT DROP`);
  for (const bottle of corpus) {
    const parts = buildBottleSearchVector(
      {
        ...bottle,
        updatedAt: new Date(bottle.updatedAt),
        brandId: bottle.brand.id,
        createdByActorId: 1,
      },
      { name: bottle.brand.name, kind: "brand", createdByActorId: 1 },
      [],
      bottle.bottler
        ? { name: bottle.bottler.name, kind: "bottler", createdByActorId: 1 }
        : undefined,
      bottle.distillers.map((d) => ({
        name: d.name,
        kind: "distillery",
        createdByActorId: 1,
      })),
      bottle.series
        ? {
            name: bottle.series.name,
            fullName: bottle.series.name,
            brandId: bottle.brand.id,
            createdByActorId: 1,
          }
        : undefined,
    );
    const query =
      dialect.sqlToQuery(sql`INSERT INTO search_benchmark_bottles VALUES (
      ${bottle.id}, ${bottle.brand.id}, ${`{${bottle.distillers.map((d) => d.id).join(",")}}`}::bigint[],
      ${bottle.totalTastings}, ${bottle.updatedAt}::timestamptz,
      ${sql.join(
        parts.map((p) => p.mapToDriverValue()),
        sql` || `,
      )},
      ${parts.map((p) => p.value).join(" ")}, ${JSON.stringify(bottle)}::jsonb
    )`);
    await client.query(query.sql, query.params);
  }
  await client.query(
    "CREATE INDEX ON search_benchmark_bottles USING gin (search_vector)",
  );
  await client.query("CREATE INDEX ON search_benchmark_bottles (brand_id)");
  await client.query(
    "CREATE INDEX ON search_benchmark_bottles USING gin (distiller_ids)",
  );
  if (values.lead)
    await client.query(
      "CREATE INDEX ON search_benchmark_bottles USING tin (search_text)",
    );
  await client.query("ANALYZE search_benchmark_bottles");

  const engines: Engine[] = values.lead
    ? ["current-gin", "structured-gin", "lead"]
    : ["current-gin", "structured-gin"];
  const results = [];
  for (const test of searchCases.filter(
    (test) =>
      values.split === "all" || (test.split ?? "development") === values.split,
  )) {
    const samples = new Map<Engine, number[]>(engines.map((e) => [e, []]));
    const outputs = new Map<Engine, { ids: number[]; retrieved: number }>();
    // Rotate execution order and warm each query once. These are warm,
    // single-client retrieval measurements, not HTTP or production latency.
    for (let run = -1; run < repeats; run++) {
      const offset = (run + 1) % engines.length;
      for (const engine of [
        ...engines.slice(offset),
        ...engines.slice(0, offset),
      ]) {
        const start = performance.now();
        const candidates = await retrieve(engine, test.input);
        const ranked = rankBottleCreateCandidates(test.input, candidates, 10);
        const elapsed = performance.now() - start;
        if (run >= 0) samples.get(engine)!.push(elapsed);
        outputs.set(engine, {
          ids: ranked.map((b) => b.id),
          retrieved: new Set(candidates.map((b) => b.id)).size,
        });
      }
    }
    for (const engine of engines) {
      const output = outputs.get(engine)!;
      const timings = samples.get(engine)!.sort((a, b) => a - b);
      const rank = output.ids.indexOf(test.expected) + 1;
      results.push({
        case: test.name,
        proposal: test.proposal,
        split: test.split ?? "development",
        engine,
        expected: test.expected,
        rank: rank || null,
        recallAt10: rank > 0,
        ...output,
        ...(engine === "lead"
          ? { timing: "not a TIN performance measurement" }
          : {
              p50Ms: timings[Math.ceil(timings.length * 0.5) - 1],
              p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
            }),
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        corpusSize: corpus.length,
        observedCorpusSize,
        syntheticCrowdingRows: corpus.length - observedCorpusSize,
        repeats,
        scope:
          "Warm single-client SQL retrieval plus existing candidate ranker. Scratch schema; no API hydration, accepted references, aliases, or production query-plan equivalence. Lead is correctness-only.",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
