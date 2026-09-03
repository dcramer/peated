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
