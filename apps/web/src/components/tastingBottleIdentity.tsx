import type { Bottle } from "@peated/server/types";
import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "@peated/web/components/bottleExactMetadata";
import Link from "@peated/web/components/link";
import SingleCaskChip from "./singleCaskChip";

export type TastingBottleIdentitySource = Pick<
  Bottle,
  "id" | "fullName" | "singleCask"
> &
  BottleExactMetadataSource & {
    brand: Pick<Bottle["brand"], "name" | "shortName">;
    group?: Pick<NonNullable<Bottle["group"]>, "name">;
  };

export default function TastingBottleIdentity({
  bottle,
  variant = "panel",
}: {
  bottle: TastingBottleIdentitySource;
  variant?: "inline" | "panel";
}) {
  if (!bottle.group) {
    throw new Error("Tasting bottle is missing its display identity.");
  }

  const displayName = `${bottle.brand.shortName || bottle.brand.name} ${bottle.group.name}`;

  if (variant === "inline") {
    return (
      <div className="flex items-center space-x-2 overflow-hidden sm:space-x-3 sm:rounded">
        <div className="flex-1 overflow-hidden">
          <div className="flex w-full items-center gap-x-1 font-bold">
            <div className="space-x-1">
              <h4 className="inline font-bold" title={bottle.fullName}>
                <Link
                  href={`/bottles/${bottle.id}`}
                  className="hover:underline"
                >
                  {displayName}
                </Link>
              </h4>
              {bottle.singleCask && <SingleCaskChip />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-4 lg:p-5">
      <Link
        href={`/bottles/${bottle.id}`}
        title={bottle.fullName}
        className="font-semibold hover:underline"
      >
        {displayName}
      </Link>
      <BottleExactMetadata bottle={bottle} />
    </div>
  );
}
