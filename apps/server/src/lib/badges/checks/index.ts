import type { BadgeCheckType } from "@peated/server/types";
import { AgeCheck } from "./ageCheck";
import type { Check } from "./base";
import { BottleCheck } from "./bottleCheck";
import { CategoryCheck } from "./categoryCheck";
import { EntityCheck } from "./entityCheck";
import { EveryTastingCheck } from "./everyTastingCheck";
import { RegionCheck } from "./regionCheck";

export function getCheck(type: BadgeCheckType): Check {
  switch (type) {
    case "age":
      return new AgeCheck();
    case "bottle":
      return new BottleCheck();
    case "category":
      return new CategoryCheck();
    case "entity":
      return new EntityCheck();
    case "region":
      return new RegionCheck();
    case "everyTasting":
      return new EveryTastingCheck();

    default:
      throw new Error(`Invalid type: ${type}`);
  }
}
