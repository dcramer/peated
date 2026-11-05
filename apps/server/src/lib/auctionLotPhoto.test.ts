import { BottleExtractedDetailsSchema } from "@peated/server/agents/bottleClassifier";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { imageLabelExtractions } from "@peated/server/db/schema";
import { afterEach, vi } from "vitest";
import {
  readAuctionLotPhotoEvidence,
  type AuctionLotPhotoServices,
} from "./auctionLotPhoto";

const originalAIGatewayApiKey = config.AI_GATEWAY_API_KEY;
const originalScraperAIGatewayApiKey = config.SCRAPER_AI_GATEWAY_API_KEY;
const thumbnailUrl =
  "https://d3suvtcq00dftb.cloudfront.net/images/c92e7897a93b0307bc3baa3fe1cdbeeb-med.jpg";
const labelUrl =
  "https://d3suvtcq00dftb.cloudfront.net/images/c92e7897a93b0307bc3baa3fe1cdbeeb-zoom.jpg";

beforeEach(() => {
  config.AI_GATEWAY_API_KEY = "test-key";
});

afterEach(() => {
  config.AI_GATEWAY_API_KEY = originalAIGatewayApiKey;
  config.SCRAPER_AI_GATEWAY_API_KEY = originalScraperAIGatewayApiKey;
});

function createServices(
  read: Awaited<ReturnType<AuctionLotPhotoServices["readImage"]>>,
): AuctionLotPhotoServices {
  return {
    readImage: vi.fn(async () => read),
    readLabel: vi.fn(async () => ({
      extractedIdentity: BottleExtractedDetailsSchema.parse({
        brand: "Maker's Mark",
        category: "bourbon",
        abv: 45,
      }),
      rawLabelText:
        "Maker's Mark Kentucky Straight Bourbon Whisky 45% Alc./Vol.",
    })),
  };
}

const okRead = {
  status: "ok" as const,
  url: labelUrl,
  contentType: "image/jpeg",
  body: new Uint8Array([1, 2, 3]),
};

test("reads the label from the large copy of the lot photo once", async () => {
  const services = createServices(okRead);

  const evidence = await readAuctionLotPhotoEvidence(
    { id: 17020, imageUrl: thumbnailUrl },
    services,
  );

  expect(services.readImage).toHaveBeenCalledWith(labelUrl);
  expect(services.readLabel).toHaveBeenCalledWith(
    "data:image/jpeg;base64,AQID",
  );
  expect(evidence).toMatchObject({
    sourceImageId: "auction_lot:17020",
    fieldCandidates: {
      brand: { value: "Maker's Mark" },
      abv: { value: 45 },
    },
    photoSuitability: {
      labelReadable: true,
      suitableAsBottleImage: false,
      suitableAsTastingImage: false,
    },
  });
  expect(evidence?.extractors[0]?.textSpans[0]?.text).toBe(
    "Maker's Mark Kentucky Straight Bourbon Whisky 45% Alc./Vol.",
  );

  // A twin lot with the same photo reuses the saved reading.
  await readAuctionLotPhotoEvidence(
    { id: 17021, imageUrl: thumbnailUrl },
    services,
  );
  expect(services.readImage).toHaveBeenCalledTimes(1);
  expect(services.readLabel).toHaveBeenCalledTimes(1);
  expect(await db.select().from(imageLabelExtractions)).toMatchObject([
    { imageUrl: labelUrl },
  ]);
});

test("a lot without a photo has no photo evidence", async () => {
  const services = createServices(okRead);

  expect(
    await readAuctionLotPhotoEvidence({ id: 1, imageUrl: null }, services),
  ).toBeNull();
  expect(services.readImage).not.toHaveBeenCalled();
});

test("a photo the source no longer serves leaves the lot without photo evidence", async () => {
  const services = createServices({
    status: "failed",
    url: labelUrl,
    reason: "not_found",
    httpStatus: 404,
  });

  expect(
    await readAuctionLotPhotoEvidence(
      { id: 1, imageUrl: thumbnailUrl },
      services,
    ),
  ).toBeNull();
  expect(services.readLabel).not.toHaveBeenCalled();
  expect(await db.select().from(imageLabelExtractions)).toEqual([]);
});

test("a photo the source keeps rejecting leaves the lot without photo evidence", async () => {
  const services = createServices({
    status: "failed",
    url: labelUrl,
    reason: "http_error",
    httpStatus: 400,
  });

  expect(
    await readAuctionLotPhotoEvidence(
      { id: 1, imageUrl: thumbnailUrl },
      services,
    ),
  ).toBeNull();
  expect(services.readLabel).not.toHaveBeenCalled();
});

test.each([
  { reason: "timeout" as const, httpStatus: null },
  { reason: "http_error" as const, httpStatus: 503 },
  { reason: "http_error" as const, httpStatus: 429 },
])(
  "a temporary photo read failure ($reason $httpStatus) throws so the job retries",
  async ({ reason, httpStatus }) => {
    const services = createServices({
      status: "failed",
      url: labelUrl,
      reason,
      httpStatus,
    });

    await expect(
      readAuctionLotPhotoEvidence({ id: 1, imageUrl: thumbnailUrl }, services),
    ).rejects.toThrow(reason);
    expect(await db.select().from(imageLabelExtractions)).toEqual([]);
  },
);

test("reads the photo with only the scraper's AI key", async () => {
  config.AI_GATEWAY_API_KEY = undefined;
  config.SCRAPER_AI_GATEWAY_API_KEY = "scraper-key";
  const services = createServices(okRead);

  expect(
    await readAuctionLotPhotoEvidence(
      { id: 1, imageUrl: thumbnailUrl },
      services,
    ),
  ).not.toBeNull();
});

test("a failed label reading throws and is not saved", async () => {
  const services = createServices(okRead);
  vi.mocked(services.readLabel).mockRejectedValue(new Error("model failed"));

  await expect(
    readAuctionLotPhotoEvidence({ id: 1, imageUrl: thumbnailUrl }, services),
  ).rejects.toThrow("model failed");
  expect(await db.select().from(imageLabelExtractions)).toEqual([]);
});
