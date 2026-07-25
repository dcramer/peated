import type { Bottle } from "@peated/server/types";
import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "@peated/web/components/bottleExactMetadata";
import Link from "@peated/web/components/link";

export type TastingBottleIdentitySource = Pick<Bottle, "id" | "fullName"> &
  BottleExactMetadataSource;

export default function TastingBottleIdentity({
  bottle,
  compact = false,
}: {
  bottle: TastingBottleIdentitySource;
  compact?: boolean;
}) {
  const content = (
    <>
      <Link
        href={`/bottles/${bottle.id}`}
        className="font-semibold hover:underline"
      >
        {bottle.fullName}
      </Link>
      <BottleExactMetadata bottle={bottle} />
    </>
  );

  if (compact) {
    return <div className="min-w-0">{content}</div>;
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-4 lg:p-5">
      {content}
    </div>
  );
}
