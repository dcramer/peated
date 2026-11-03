import { prepareSpan } from "./sentry";

test("excludes database values from spans while keeping query details", () => {
  const span = {
    trace_id: "trace",
    span_id: "span",
    name: "drizzle.driver.execute",
    start_timestamp: 1,
    end_timestamp: 2,
    status: "ok" as const,
    is_segment: false,
    attributes: {
      "drizzle.query.text": "insert into review_body values ($1, $2, $3)",
      "drizzle.query.params": JSON.stringify([
        1,
        "private review text",
        "date",
      ]),
    },
  };

  const result = prepareSpan(span);

  expect(result.attributes).toEqual({
    "drizzle.query.text": span.attributes["drizzle.query.text"],
  });
  expect(JSON.stringify(result)).not.toContain("private review text");
});

test("names an AI SDK agent span after its function id", () => {
  const span = {
    trace_id: "trace",
    span_id: "span",
    name: "invoke_agent bottle_classifier",
    start_timestamp: 1,
    end_timestamp: 2,
    status: "ok" as const,
    is_segment: false,
    attributes: { "gen_ai.function_id": "bottle_classifier" },
  };

  expect(prepareSpan(span).attributes).toMatchObject({
    "gen_ai.agent.name": "bottle_classifier",
  });
});

test("keeps an agent name that is already set", () => {
  const span = {
    trace_id: "trace",
    span_id: "span",
    name: "invoke_agent Scraper Setup",
    start_timestamp: 1,
    end_timestamp: 2,
    status: "ok" as const,
    is_segment: false,
    attributes: {
      "gen_ai.agent.name": "Scraper Setup",
      "gen_ai.function_id": "scraper_setup",
    },
  };

  expect(prepareSpan(span).attributes["gen_ai.agent.name"]).toBe(
    "Scraper Setup",
  );
});
