import { describe, expect, test } from "vitest";
import { GenerateBottleDetailsJobArgsSchema } from "./generateBottleDetails";
import { IndexBottleAliasJobArgsSchema } from "./indexBottleAlias";
import { IndexBottleSearchVectorsJobArgsSchema } from "./indexBottleSearchVectors";
import { NotifyDiscordOnTastingJobArgsSchema } from "./notifyDiscordOnTasting";
import { OnBottleAliasChangeJobArgsSchema } from "./onBottleAliasChange";
import { VerifyBottleCreationJobArgsSchema } from "./verifyBottleCreation";

describe("Bottle job payloads", () => {
  test.each([
    [GenerateBottleDetailsJobArgsSchema, { bottleId: 1 }],
    [IndexBottleSearchVectorsJobArgsSchema, { bottleId: 1 }],
    [IndexBottleAliasJobArgsSchema, { name: "Direct Bottle Alias" }],
    [OnBottleAliasChangeJobArgsSchema, { name: "Direct Bottle Alias" }],
    [NotifyDiscordOnTastingJobArgsSchema, { tastingId: 1 }],
    [
      VerifyBottleCreationJobArgsSchema,
      { bottleId: 1, creationSource: "manual_entry" },
    ],
  ])("accepts the owned queue contract %#", (schema, payload) => {
    expect(schema.parse(payload)).toEqual(payload);
  });

  test.each([
    [GenerateBottleDetailsJobArgsSchema, { bottleId: 1 }],
    [IndexBottleSearchVectorsJobArgsSchema, { bottleId: 1, groupId: 2 }],
    [IndexBottleAliasJobArgsSchema, { name: "" }],
    [OnBottleAliasChangeJobArgsSchema, { targetId: 1 }],
    [NotifyDiscordOnTastingJobArgsSchema, { tastingId: 0 }],
    [
      VerifyBottleCreationJobArgsSchema,
      { bottleId: 1, creationSource: "legacy_release" },
    ],
  ])("rejects malformed or legacy identity payload %#", (schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });
});
