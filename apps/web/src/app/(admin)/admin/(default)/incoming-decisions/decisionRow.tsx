import type { Outputs } from "@peated/server/orpc/router";
import Link from "@peated/web/components/link";

type DecisionLogItem =
  Outputs["admin"]["incomingBottleDecisions"]["results"][number];

export function formatDecision(value: DecisionLogItem["decision"]): string {
  switch (value) {
    case "match_existing":
      return "Matched Existing";
    case "create_bottle":
      return "Created Bottle";
    case "create_release":
      return "Created Release";
    case "create_bottle_and_release":
      return "Created Bottle + Release";
  }
}

export function DecisionBottle({
  bottle,
}: {
  bottle: Pick<DecisionLogItem["bottle"], "id" | "fullName">;
}) {
  return (
    <Link href={`/bottles/${bottle.id}`} className="text-sm underline">
      {bottle.fullName}
    </Link>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getSourceLabel(item: DecisionLogItem): string {
  return item.sourceKind === "store_price" ? "Store Price" : "Review";
}

function getActorLabel(item: DecisionLogItem): string {
  return item.actor.displayName;
}

function getDecisionTone(item: DecisionLogItem): string {
  if (item.actor.type === "system") {
    return "border-sky-800 bg-sky-950/50 text-sky-200";
  }

  return "border-emerald-800 bg-emerald-950/50 text-emerald-200";
}

export default function DecisionRow({ item }: { item: DecisionLogItem }) {
  return (
    <tr className="border-b border-slate-800 last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
        {formatDate(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-white">{item.name}</div>
        <div className="mt-1 text-xs text-slate-400">
          {item.externalSite.name} · {getSourceLabel(item)} #{item.sourceId}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${getDecisionTone(item)}`}
        >
          {formatDecision(item.decision)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {getActorLabel(item)}
      </td>
      <td className="px-4 py-3">
        <DecisionBottle bottle={item.bottle} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {item.url ? (
          <Link href={item.url} className="underline">
            Source
          </Link>
        ) : (
          "n/a"
        )}
      </td>
    </tr>
  );
}
