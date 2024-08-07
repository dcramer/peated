import { z } from "zod";
import {
  CASK_FILLS,
  CASK_SIZE_IDS,
  CASK_TYPE_IDS,
  CATEGORY_LIST,
  CURRENCY_LIST,
  ENTITY_TYPE_LIST,
  FLAVOR_PROFILES,
  SERVING_STYLE_LIST,
} from "../constants";
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

export const ContentSourceEnum = z.enum(["generated", "user"]);

export const CurrencyEnum = z.enum(CURRENCY_LIST);

export const CaskFillEnum = z.enum(CASK_FILLS);

export const CaskTypeEnum = z.enum(CASK_TYPE_IDS);

export const CaskSizeEnum = z.enum(CASK_SIZE_IDS);

export const CategoryEnum = z.enum(CATEGORY_LIST);

export const EntityTypeEnum = z.enum(ENTITY_TYPE_LIST);

export const FlavorProfileEnum = z.enum(FLAVOR_PROFILES);

export const ServingStyleEnum = z.enum(SERVING_STYLE_LIST);
