import { describe, expect, test } from "vitest";
import { z } from "zod";
import { agentOutput, strictAgentTool } from "./index";

describe("agentOutput", () => {
  test("requires fields with defaults and removes formats", () => {
    const { schema } = agentOutput(
      "answer",
      z
        .object({
          summary: z.string(),
          target: z.number().nullable().default(null),
          website: z.string().url().nullable().default(null),
        })
        .strict(),
    );

    expect(schema.required).toEqual(["summary", "target", "website"]);
    expect(JSON.stringify(schema)).not.toContain('"format"');
  });
});

describe("strictAgentTool", () => {
  const parameters = z
    .object({ url: z.string().url(), limit: z.number().default(10) })
    .strict();
  const pageTool = strictAgentTool({
    name: "read_page",
    description: "Read one page.",
    parameters,
    execute: async (input) => input,
  });

  test("sends a strict schema with no formats", () => {
    expect(pageTool.strict).toBe(true);
    expect(pageTool.inputSchema.required).toEqual(["url", "limit"]);
    expect(JSON.stringify(pageTool.inputSchema)).not.toContain('"format"');
  });

  test("still checks input against the tool's own rules", async () => {
    await expect(
      pageTool.execute(
        { url: "not a url", limit: 5 },
        { toolCallId: "call-1" },
      ),
    ).rejects.toThrow();
  });
});
