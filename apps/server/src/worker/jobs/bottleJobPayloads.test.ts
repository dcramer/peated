import { describe, expect, test } from "vitest";
import { GenerateBottleDetailsJobArgsSchema } from "./generateBottleDetails";
import { IndexBottleReferenceJobArgsSchema } from "./indexBottleReference";
import { IndexBottleSearchVectorsJobArgsSchema } from "./indexBottleSearchVectors";
import { NotifyDiscordOnTastingJobArgsSchema } from "./notifyDiscordOnTasting";
import { OnBottleReferenceChangeJobArgsSchema } from "./onBottleReferenceChange";
import { VerifyBottleCreationJobArgsSchema } from "./verifyBottleCreation";

describe("Bottle job payloads", () => {
  test.each([
    [GenerateBottleDetailsJobArgsSchema, { bottleId: 1 }],
    [IndexBottleSearchVectorsJobArgsSchema, { bottleId: 1 }],
    [IndexBottleReferenceJobArgsSchema, { name: "Direct Bottle Alias" }],
    [OnBottleReferenceChangeJobArgsSchema, { name: "Direct Bottle Alias" }],
    [NotifyDiscordOnTastingJobArgsSchema, { tastingId: 1 }],
    [
      VerifyBottleCreationJobArgsSchema,
      { bottleId: 1, creationSource: "manual_entry" },
    ],
  ])("accepts the owned queue contract %#", (schema, payload) => {
    expect(schema.parse(payload)).toEqual(payload);
  });

  test.each([
    [GenerateBottleDetailsJobArgsSchema, { bottleId: 1, releaseId: 2 }],
    [IndexBottleSearchVectorsJobArgsSchema, { bottleId: 1, groupId: 2 }],
    [IndexBottleReferenceJobArgsSchema, { name: "" }],
    [OnBottleReferenceChangeJobArgsSchema, { targetId: 1 }],
    [NotifyDiscordOnTastingJobArgsSchema, { tastingId: 0 }],
    [
      VerifyBottleCreationJobArgsSchema,
      { bottleId: 1, creationSource: "legacy_release" },
    ],
  ])("rejects malformed or legacy identity payload %#", (schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });
});
