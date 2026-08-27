import type { MockOutputs } from "../contract";
import { mockBottleFor, mockBottles } from "./bottles";
import { timestamp } from "./constants";
import { mockFriends, mockPublicUser } from "./users";

type Flight = MockOutputs["flights"]["list"]["results"][number];
type User = MockOutputs["auth"]["login"]["user"];

export const mockFlight = {
  id: "mock-islay-flight",
  name: "Islay Smoke",
  description: "A side-by-side tasting of smoky Islay whisky.",
  public: true,
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Flight;

export const mockFlights = [
  mockFlight,
  {
    id: "mock-world-flight",
    name: "Whisky Around the World",
    description:
      "Compare Scotch, bourbon, Japanese whisky, and Irish pot still whiskey.",
    public: true,
    createdAt: "2026-08-18T12:00:00.000Z",
    createdBy: mockFriends[0],
  },
  {
    id: "mock-sherry-flight",
    name: "Fruit and Sherry",
    description: "Rich whiskies with dried fruit and cask spice.",
    public: true,
    createdAt: "2026-08-12T12:00:00.000Z",
    createdBy: mockFriends[1],
  },
  {
    id: "mock-cabinet-flight",
    name: "Open Cabinet",
    description: "A private flight from the signed-in user's open bottles.",
    public: false,
    createdAt: "2026-08-08T12:00:00.000Z",
    createdBy: mockPublicUser,
  },
] satisfies Flight[];

export const mockFlightBottleIds = new Map<string, number[]>([
  [mockFlight.id, [9301, 9307, 9308]],
  ["mock-world-flight", [9302, 9304, 9305, 9306]],
  ["mock-sherry-flight", [9302, 9306]],
  ["mock-cabinet-flight", [9301, 9303, 9306]],
]);

export function mockFlightDetailsFor(
  user: User | null,
  flight: Flight = mockFlight,
): MockOutputs["flights"]["details"] {
  const bottles = (mockFlightBottleIds.get(flight.id) ?? []).flatMap((id) => {
    const bottle = mockBottles.find((candidate) => candidate.id === id);
    return bottle ? [mockBottleFor(user, bottle)] : [];
  });

  return {
    ...flight,
    bottles: bottles.map((bottle) => ({
      bottle,
      hasTasted: bottle.hasTasted,
      isLibrary: bottle.isLibrary,
    })),
  };
}
