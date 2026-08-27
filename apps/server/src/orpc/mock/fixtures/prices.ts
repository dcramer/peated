import type { MockOutputs } from "../contract";
import { mockBottleFor, mockBottles } from "./bottles";
import type { MockUser } from "./users";

export const mockBottlePrices = [
  {
    id: 9930,
    name: "Lagavulin 16 Year Old 700ml",
    externalProductId: "shop-9930",
    barcode: "5000281016290",
    price: 8999,
    currency: "usd",
    url: "https://example.com/shop/lagavulin-16",
    volume: 700,
    site: {
      id: 9931,
      type: "totalwine",
      name: "Total Wine",
      lastRunAt: "2026-08-26T09:00:00.000Z",
      nextRunAt: null,
      runEvery: 1440,
    },
    updatedAt: "2026-08-26T09:00:00.000Z",
    imageUrl: null,
    isValid: true,
    bottle: mockBottles[0]!,
  },
  {
    id: 9932,
    name: "Lagavulin 16 Single Malt Scotch",
    externalProductId: "shop-9932",
    barcode: null,
    price: 9499,
    currency: "usd",
    url: "https://example.com/shop/lagavulin-16-alt",
    volume: 750,
    site: {
      id: 9933,
      type: "woodencork",
      name: "Wooden Cork",
      lastRunAt: "2026-08-25T09:00:00.000Z",
      nextRunAt: null,
      runEvery: 1440,
    },
    updatedAt: "2026-08-25T09:00:00.000Z",
    imageUrl: null,
    isValid: true,
    bottle: mockBottles[0]!,
  },
  {
    id: 9934,
    name: "Lagavulin 16 Year Old",
    externalProductId: null,
    barcode: null,
    price: 7999,
    currency: "usd",
    url: "https://example.com/shop/lagavulin-16-old",
    volume: 700,
    site: {
      id: 9935,
      type: "healthyspirits",
      name: "Healthy Spirits",
      lastRunAt: "2026-08-01T09:00:00.000Z",
      nextRunAt: null,
      runEvery: 1440,
    },
    updatedAt: "2026-08-01T09:00:00.000Z",
    imageUrl: null,
    isValid: false,
    bottle: mockBottles[0]!,
  },
] satisfies MockOutputs["bottles"]["prices"]["list"]["results"];

const priceChanges = [
  { id: 9301, price: 8999, previousPrice: 9999, currency: "usd" as const },
  { id: 9302, price: 7299, previousPrice: 6599, currency: "usd" as const },
  { id: 9305, price: 14999, previousPrice: 16999, currency: "usd" as const },
];

export function mockPriceChangesFor(
  user: MockUser | null,
): MockOutputs["prices"]["changeList"]["results"] {
  return priceChanges.map((priceChange) => {
    const bottle = mockBottleFor(
      user,
      mockBottles.find((candidate) => candidate.id === priceChange.id)!,
    );
    return {
      ...priceChange,
      bottle,
      isLibrary: bottle.isLibrary,
      hasTasted: bottle.hasTasted,
    };
  });
}
