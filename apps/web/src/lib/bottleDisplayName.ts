import type { Bottle } from "@peated/server/types";

type BottleDisplayNameSource = Pick<Bottle, "fullName"> & {
  group?: Pick<NonNullable<Bottle["group"]>, "fullName">;
};

export function getBottleDisplayName(bottle: BottleDisplayNameSource) {
  return bottle.group?.fullName ?? bottle.fullName;
}
