import { BadgeCheckSchema } from "@peated/server/schemas/badges";
import { AgeCheck } from "./ageCheck";
import { BottleCheck } from "./bottleCheck";
import { CategoryCheck } from "./categoryCheck";
import { EntityCheck } from "./entityCheck";
import { EveryTastingCheck } from "./everyTastingCheck";
import { RegionCheck } from "./regionCheck";

import type { BadgeTasting } from "../types";

export type PreparedBadgeCheck = {
  test(tasting: BadgeTasting): boolean;
};

/** Parses one stored badge check before binding it to the in-memory evaluator. */
export function prepareBadgeCheck(input: unknown): PreparedBadgeCheck {
  const check = BadgeCheckSchema.parse(input);

  switch (check.type) {
    case "age": {
      const impl = new AgeCheck();
      return { test: (tasting) => impl.test(check.config, tasting) };
    }
    case "bottle": {
      const impl = new BottleCheck();
      return { test: (tasting) => impl.test(check.config, tasting) };
    }
    case "category": {
      const impl = new CategoryCheck();
      return { test: (tasting) => impl.test(check.config, tasting) };
    }
    case "entity": {
      const impl = new EntityCheck();
      return { test: (tasting) => impl.test(check.config, tasting) };
    }
    case "region": {
      const impl = new RegionCheck();
      return { test: (tasting) => impl.test(check.config, tasting) };
    }
    case "everyTasting": {
      const impl = new EveryTastingCheck();
      return { test: (tasting) => impl.test(check.config, tasting) };
    }
  }
}
