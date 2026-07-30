import type { Outputs } from "@peated/server/orpc/router";

export type BottleOperationActionResult =
  Outputs["bottleChecks"]["approveSelected"]["results"][number];

export async function runActionWithCanonicalRefresh<T>({
  action,
  refresh,
}: {
  action: () => Promise<T>;
  refresh: () => Promise<void>;
}): Promise<T> {
  const result = await action();
  await refresh();
  return result;
}

export default function ActionResults({
  results,
}: {
  results: BottleOperationActionResult[];
}) {
  if (results.length === 0) return null;
  return (
    <section
      aria-label="Operation results"
      className="rounded-xl border border-slate-800 bg-slate-950 p-5"
    >
      <h2 className="font-semibold text-white">Operation results</h2>
      <p className="mt-1 text-xs text-slate-400">
        Each selected operation was processed independently.
      </p>
      <ul className="mt-3 divide-y divide-slate-800 text-sm">
        {results.map((result) => (
          <li
            className="flex flex-wrap items-start justify-between gap-3 py-3"
            key={result.operationId}
          >
            <span className="text-slate-200">
              Operation #{result.operationId}
            </span>
            <span className="text-right">
              <span className="font-semibold capitalize text-white">
                {result.status
                  ? result.status.replaceAll("_", " ")
                  : "Not processed"}
              </span>
              {result.error ? (
                <span className="mt-1 block text-xs text-red-300">
                  {result.error}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
