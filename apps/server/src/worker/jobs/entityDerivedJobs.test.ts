import config from "@peated/server/config";
import { afterEach, beforeEach, expect, test } from "vitest";
import generateEntityDetails from "./generateEntityDetails";
import geocodeEntityLocation from "./geocodeEntityLocation";
import indexEntitySearchVectors from "./indexEntitySearchVectors";

const originalAiGatewayApiKey = config.AI_GATEWAY_API_KEY;
const originalGoogleMapsApiKey = config.GOOGLE_MAPS_API_KEY;

beforeEach(() => {
  config.AI_GATEWAY_API_KEY = "test-api-key";
  config.GOOGLE_MAPS_API_KEY = "test-api-key";
});

afterEach(() => {
  config.AI_GATEWAY_API_KEY = originalAiGatewayApiKey;
  config.GOOGLE_MAPS_API_KEY = originalGoogleMapsApiKey;
});

test("skips stale derived work for a deleted Entity", async () => {
  const entityId = 2_147_483_647;

  await expect(generateEntityDetails({ entityId })).resolves.toBeUndefined();
  await expect(indexEntitySearchVectors({ entityId })).resolves.toBeUndefined();
  await expect(geocodeEntityLocation({ entityId })).resolves.toBeUndefined();
});
