import type { CatalogTargetV1 } from "@peated/server/schemas";
import Link from "@peated/web/components/link";
import {
  getCatalogTargetHref,
  getCatalogTargetLabel,
  getCatalogTargetScopeLabel,
} from "@peated/web/lib/catalogTarget";
import type { MouseEventHandler } from "react";

export default function CatalogTargetIdentity({
  target,
  compact = false,
  onClick,
}: {
  target: CatalogTargetV1;
  compact?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const href = getCatalogTargetHref(target);
  const label = getCatalogTargetLabel(target);
  const identity = (
    <Link
      href={href}
      className="font-semibold hover:underline"
      onClick={onClick}
    >
      {label}
    </Link>
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
