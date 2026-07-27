import { expect, test } from "vitest";
import {
  readJoinedUserBottle,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

test("fails closed when a stored Bottle has no BottleGroup", () => {
  expect(() =>
    readJoinedUserBottle({
      storedBottleId: 42,
      bottle: {
        id: 42,
        groupId: null,
        brandId: 1,
        category: null,
        flavorProfile: null,
        statedAge: null,
      },
      retiredBottleId: null,
      retiredGroupId: null,
    }),
  ).toThrow(new UserBottleReadIntegrityError("Bottle 42 has no BottleGroup."));
});
