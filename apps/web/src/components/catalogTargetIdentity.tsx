import type { CatalogTargetV1 } from "@peated/server/schemas";
import Link from "@peated/web/components/link";
import {
  getCatalogTargetHref,
  getCatalogTargetLabel,
  getCatalogTargetScopeLabel,
} from "@peated/web/lib/catalogTarget";

export default function CatalogTargetIdentity({
  target,
  compact = false,
}: {
  target: CatalogTargetV1;
  compact?: boolean;
}) {
  const href = getCatalogTargetHref(target);
  const label = getCatalogTargetLabel(target);
  const identity = href ? (
    <Link href={href} className="font-semibold hover:underline">
      {label}
    </Link>
  ) : (
    <span className="font-semibold">{label}</span>
  );

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        {identity}
        <span className="text-muted text-xs">
          {getCatalogTargetScopeLabel(target)}
        </span>
      </span>
    );
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-4 lg:p-5">
      <div className="truncate">{identity}</div>
      <div className="text-muted mt-1 text-sm">
        {getCatalogTargetScopeLabel(target)}
      </div>
    </div>
  );
}
