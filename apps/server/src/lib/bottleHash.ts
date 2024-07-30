import { createHash } from "crypto";

export function generateUniqHash(
  bottle: {
    fullName: string;
    vintageYear?: number | null | undefined;
    releaseYear?: number | null | undefined;
  } & Record<string, any>,
) {
  let hash = createHash("md5");
  hash = hash.update(bottle.fullName.toLowerCase());
  if (bottle.vintageYear) hash = hash.update(`${bottle.vintageYear}`);
  else if (bottle.releaseYear) hash = hash.update(`${bottle.releaseYear}`);
  return hash.digest("hex");
}
