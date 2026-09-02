import { describe, expect, test } from "vitest";
import { CapturePriceImageJobArgsSchema } from "./capturePriceImage";
import { GenerateCountryDetailsJobArgsSchema } from "./generateCountryDetails";
import { GenerateEntityDetailsJobArgsSchema } from "./generateEntityDetails";
import { GenerateRegionDetailsJobArgsSchema } from "./generateRegionDetails";
import { GeocodeCountryLocationJobArgsSchema } from "./geocodeCountryLocation";
import { GeocodeEntityLocationJobArgsSchema } from "./geocodeEntityLocation";
import { GeocodeRegionLocationJobArgsSchema } from "./geocodeRegionLocation";
import { IndexBottleSeriesSearchVectorsJobArgsSchema } from "./indexBottleSeriesSearchVectors";
import { IndexEntitySearchVectorsJobArgsSchema } from "./indexEntitySearchVectors";
import { OnEntityChangeJobArgsSchema } from "./onEntityChange";
import { ProcessNotificationJobArgsSchema } from "./processNotification";
import { ProcessStorePriceMatchRetryRunJobArgsSchema } from "./processStorePriceMatchRetryRun";
import { ResolveStorePriceBottleJobArgsSchema } from "./resolveStorePriceBottle";
import { VerifyEntityCreationJobArgsSchema } from "./verifyEntityCreation";

const jobPayloads = [
  [
    CapturePriceImageJobArgsSchema,
    { priceId: 1, imageUrl: "https://example.com/a.jpg" },
  ],
  [GenerateCountryDetailsJobArgsSchema, { countryId: 1 }],
  [GenerateEntityDetailsJobArgsSchema, { entityId: 1 }],
  [GenerateRegionDetailsJobArgsSchema, { regionId: 1 }],
  [GeocodeCountryLocationJobArgsSchema, { countryId: 1 }],
  [GeocodeEntityLocationJobArgsSchema, { entityId: 1 }],
  [GeocodeRegionLocationJobArgsSchema, { regionId: 1 }],
  [IndexBottleSeriesSearchVectorsJobArgsSchema, { seriesId: 1 }],
  [IndexEntitySearchVectorsJobArgsSchema, { entityId: 1 }],
  [OnEntityChangeJobArgsSchema, { entityId: 1 }],
  [ProcessNotificationJobArgsSchema, { notificationId: 1 }],
  [ProcessStorePriceMatchRetryRunJobArgsSchema, { runId: 1 }],
  [ResolveStorePriceBottleJobArgsSchema, { priceId: 1 }],
  [
    VerifyEntityCreationJobArgsSchema,
    { entityId: 1, creationSource: "manual_entry" },
  ],
] as const;

describe("worker job payloads", () => {
  test.each(jobPayloads)(
    "accepts the owned queue contract %#",
    (schema, payload) => {
      expect(schema.safeParse(payload).success).toBe(true);
    },
  );

  test.each(jobPayloads)(
    "rejects unknown queue fields %#",
    (schema, payload) => {
      expect(schema.safeParse({ ...payload, unexpected: true }).success).toBe(
        false,
      );
    },
  );

  test.each(jobPayloads)("rejects missing queue arguments %#", (schema) => {
    expect(schema.safeParse(undefined).success).toBe(false);
  });
});
