import { createHash } from "crypto";
import { type Bottle } from "../db/schema";

export function generateUniqHash(
  bottle: Partial<Bottle> & {
    fullName: string;
  },
) {
  let hash = createHash("md5");
  hash = hash.update(bottle.fullName.toLowerCase());
  if (bottle.vintageYear) hash = hash.update(`${bottle.vintageYear}`);
  return hash.digest("hex");
}
