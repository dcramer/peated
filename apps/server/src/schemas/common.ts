import { z } from "zod";
import { CURRENCY_LIST, FLAVOR_PROFILES } from "../constants";
import { isDistantFuture, isDistantPast } from "../lib/dates";

export const zTag = z.string();

export const zDatetime = z
  .string()
  .datetime()
  .superRefine((value, ctx) => {
    const newValue = new Date(value);
    if (isDistantFuture(newValue, 60 * 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Value too far in future.",
      });

      return z.NEVER;
    }

    if (isDistantPast(newValue, 60 * 60 * 24 * 7)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Value too far in the past.",
      });

      return z.NEVER;
    }

    return value;
  });

export const FlavorProfileEnum = z.enum(FLAVOR_PROFILES);

export const ContentSourceEnum = z.enum(["generated", "user"]);

export const CurrencyEnum = z.enum(CURRENCY_LIST);
