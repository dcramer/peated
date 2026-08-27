"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import Chip from "@peated/web/components/chip";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQueries } from "@tanstack/react-query";

export default function OwnedEntities({ ownerId }: { ownerId: number }) {
  const orpc = useORPC();
  const input = { owner: ownerId, limit: 500, sort: "name" as const };
  const results = useSuspenseQueries({
    queries: [
      orpc.brands.list.queryOptions({ input }),
      orpc.distilleries.list.queryOptions({ input }),
      orpc.bottlers.list.queryOptions({ input }),
      orpc.blenders.list.queryOptions({ input }),
      orpc.companies.list.queryOptions({ input }),
    ],
  });
  const entities = results
    .flatMap(({ data }) => data.results)
    .toSorted((left, right) => left.name.localeCompare(right.name));

  if (entities.length === 0) return null;

  return (
    <section className="my-8">
      <h2 className="mb-3 text-xl font-semibold">Owned Entities</h2>
      <ul className="divide-y divide-slate-800">
        {entities.map((entity) => (
          <li key={entity.id} className="flex items-center gap-2 py-2">
            <Link
              href={`/entities/${entity.id}`}
              className="font-medium hover:underline"
            >
              {entity.name}
            </Link>
            <Chip size="small">{toTitleCase(entity.kind)}</Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
