import { z } from "zod";

export const BooleanQueryParam = (defaultVal: boolean) => {
  return z
    .string()
    .default(defaultVal ? "1" : "0")
    .transform((v) => v === "1" || v.toLowerCase() === "true")
    .pipe(z.coerce.boolean());
};

export const CursorQueryParam = (defaultVal = 1) => {
  return z
    .string()
    .default(defaultVal.toString())
    .pipe(z.coerce.number().gte(1));
};

export const LimitQueryParam = (defaultVal = 100) => {
  return z
    .string()
    .default(defaultVal.toString())
    .pipe(z.coerce.number().gte(1).lte(defaultVal));
};
