import { isORPCNotFoundError } from "@peated/orpc/client/errors";
import { logError } from "@peated/web/lib/log";

type SaveWrongPhotoMatchPick = (input: {
  wrongPhotoMatch: number;
  correctBottle: number;
}) => Promise<{ withdrawn: boolean }>;

/**
 * Saves the Bottle a member chose after reporting a wrong photo match, using
 * `orpc.wrongPhotoMatches.update.call`. Returns `true` when the report no
 * longer exists: this pick withdrew it (the member chose the matched Bottle) or
 * an earlier one did. Callers then stop sending its ID. Any other failure only
 * loses report detail, so it is logged and never blocks the member.
 */
export async function saveWrongPhotoMatchPick(
  save: SaveWrongPhotoMatchPick,
  wrongPhotoMatch: number,
  correctBottle: number,
): Promise<boolean> {
  try {
    const { withdrawn } = await save({ wrongPhotoMatch, correctBottle });
    return withdrawn;
  } catch (err) {
    if (isORPCNotFoundError(err)) return true;
    logError(err);
    return false;
  }
}
