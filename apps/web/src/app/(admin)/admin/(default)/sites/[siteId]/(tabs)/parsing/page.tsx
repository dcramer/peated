"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  ExternalSiteKeySchema,
  ScrapeRulesSchema,
} from "@peated/server/schemas";
import Button from "@peated/web/components/button";
import FormError from "@peated/web/components/formError";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { use, useMemo, useState } from "react";
import PreviewResult from "./previewResult";
import { SetupNotice, SetupSteps } from "./setupStatus";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];

export default function Page(props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(props.params);
  const site = ExternalSiteKeySchema.parse(siteId);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const query = orpc.externalSites.scrapeSources.list.queryOptions({
    input: { site },
  });
  const { data: sources } = useSuspenseQuery({
    ...query,
    refetchInterval: ({ state }) => {
      const current = state.data?.[0];
      if (!current) return false;
      if (!current.revisions.length) {
        return current.setup?.status === "failed" ? false : 2_000;
      }
      return current.setup?.status === "queued" ||
        current.setup?.status === "running"
        ? 2_000
        : false;
    },
  });
  const source = sources[0];
  if (!source) throw new Error("Site setup not found.");

  return (
    <ConfigEditor
      key={source.revisions[0]?.id ?? "setup"}
      source={source}
      refresh={async () => {
        await queryClient.invalidateQueries({ queryKey: query.queryKey });
      }}
    />
  );
}

function ConfigEditor({
  source,
  refresh,
}: {
  source: Source;
  refresh: () => Promise<void>;
}) {
  const orpc = useORPC();
  const [error, setError] = useState<string>();
  const latest = source.revisions[0];
  const [listUrl, setListUrl] = useState(latest?.listUrl ?? source.listUrl);
  const [rulesText, setRulesText] = useState(() =>
    latest ? JSON.stringify(latest.rules, null, 2) : "",
  );
  const createRevision = useMutation(
    orpc.externalSites.scrapeSources.createRevision.mutationOptions(),
  );
  const preview = useMutation(
    orpc.externalSites.scrapeSources.preview.mutationOptions(),
  );
  const activate = useMutation(
    orpc.externalSites.scrapeSources.activate.mutationOptions(),
  );
  const pause = useMutation(
    orpc.externalSites.scrapeSources.pause.mutationOptions(),
  );
  const suggest = useMutation(
    orpc.externalSites.scrapeSources.suggest.mutationOptions(),
  );
  const busy =
    createRevision.isPending ||
    preview.isPending ||
    activate.isPending ||
    pause.isPending ||
    suggest.isPending;
  const activeRevision = useMemo(
    () =>
      source.revisions.find(
        (revision) => revision.id === source.activeRevisionId,
      ),
    [source],
  );
  const setupInProgress =
    source.setup?.status === "queued" || source.setup?.status === "running";
  const canSuggest =
    !setupInProgress && (!latest || latest.previewStatus === "failed");

  async function runAndRefresh(callback: () => Promise<void>) {
    setError(undefined);
    try {
      await callback();
      await refresh();
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  const retrySetup = () => {
    if (!canSuggest) return;
    void runAndRefresh(async () => {
      await suggest.mutateAsync({ id: source.id });
    });
  };

  return (
    <div className="space-y-6 py-6">
      {error && <FormError values={[error]} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {source.kind === "review"
              ? "Review collection"
              : "Price collection"}
          </h1>
          <p className="text-muted mt-1 text-sm">
            {activeRevision
              ? `Version ${activeRevision.revision} is active.`
              : "Collection stays paused until you preview and activate a version."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void refresh()} disabled={busy}>
            Refresh
          </Button>
          {source.enabled && (
            <Button
              color="danger"
              disabled={busy}
              onClick={() =>
                void runAndRefresh(async () => {
                  await pause.mutateAsync({ id: source.id });
                })
              }
            >
              Pause collection
            </Button>
          )}
        </div>
      </div>

      <SetupSteps source={source} />
      <SetupNotice
        source={source}
        busy={busy}
        canRetry={canSuggest}
        retry={retrySetup}
      />

      {latest && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Versions</h2>
          {source.revisions.map((revision) => (
            <div
              key={revision.id}
              className="rounded border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    Version {revision.revision}
                    {revision.id === source.activeRevisionId && " · Active"}
                  </div>
                  <div className="text-muted mt-1 text-sm">
                    {revision.previewStatus === "pending"
                      ? "Not previewed"
                      : revision.previewStatus === "passed"
                        ? "Preview passed"
                        : "Preview failed"}
                    {revision.author === "ai"
                      ? " · Created with AI"
                      : " · Created by a person"}
                  </div>
                  <div className="text-muted mt-1 break-all text-xs">
                    {revision.listUrl}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {revision.previewStatus === "failed" &&
                    revision.id === latest.id &&
                    canSuggest && (
                      <Button disabled={busy} onClick={retrySetup}>
                        Ask AI to repair
                      </Button>
                    )}
                  <Button
                    color={
                      revision.previewStatus === "pending"
                        ? "highlight"
                        : undefined
                    }
                    disabled={busy}
                    loading={preview.isPending}
                    onClick={() =>
                      void runAndRefresh(async () => {
                        await preview.mutateAsync({
                          id: source.id,
                          revisionId: revision.id,
                        });
                      })
                    }
                  >
                    Preview version
                  </Button>
                  <Button
                    color="highlight"
                    disabled={busy || revision.previewStatus !== "passed"}
                    onClick={() =>
                      void runAndRefresh(async () => {
                        await activate.mutateAsync({
                          id: source.id,
                          revisionId: revision.id,
                        });
                      })
                    }
                  >
                    {revision.id === source.activeRevisionId
                      ? "Active"
                      : revision.revision < (activeRevision?.revision ?? 0)
                        ? "Roll back"
                        : "Activate"}
                  </Button>
                </div>
              </div>
              {revision.previewStatus !== "pending" && (
                <PreviewResult revision={revision} />
              )}
            </div>
          ))}
        </div>
      )}

      {latest && (
        <details className="rounded border border-slate-800 bg-slate-950 p-4">
          <summary className="cursor-pointer font-semibold text-white">
            Edit site setup <span className="text-muted">(advanced)</span>
          </summary>
          <p className="text-muted mt-3 text-sm">
            Use this only when you need to correct the generated setup by hand.
            Saving creates a new version.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              className="mt-4 block font-semibold text-white"
              htmlFor="list-url"
            >
              Collection page
            </label>
          </div>
          <input
            id="list-url"
            type="url"
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            value={listUrl}
            onChange={(event) => setListUrl(event.target.value)}
            required
          />
          <textarea
            id="parsing-rules"
            className="mt-4 min-h-96 w-full rounded border border-slate-700 bg-slate-900 p-3 font-mono text-sm"
            value={rulesText}
            onChange={(event) => setRulesText(event.target.value)}
            spellCheck={false}
          />
          <div className="mt-3 flex justify-end">
            <Button
              color="highlight"
              disabled={busy}
              onClick={() =>
                void runAndRefresh(async () => {
                  await createRevision.mutateAsync({
                    id: source.id,
                    listUrl,
                    rules: ScrapeRulesSchema.parse(JSON.parse(rulesText)),
                  });
                })
              }
            >
              Save as new version
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
