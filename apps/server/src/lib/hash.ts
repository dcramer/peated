import { createHash } from "crypto";
import { notEmpty } from "../lib/filter";

export function sha1(...value: (string | number | null | undefined)[]) {
  const sum = createHash("sha1");
  for (const v of value) {
    sum.update(`${notEmpty(v) ? v : ""}`);
  }
  return sum.digest("hex");
}
