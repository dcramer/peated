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

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];
type Revision = Source["revisions"][number];

function defaultRules(kind: Source["kind"]) {
  return kind === "review"
    ? {
        kind: "review",
        list: {
          detailLink: { selector: "a.review", attribute: "href" },
          maxItems: 25,
        },
        detail: {
          title: { selector: "h1" },
          reviewItem: "article.review",
          name: { selector: "h2" },
          reviewerName: { selector: ".author" },
          reviewText: { selector: ".review-body" },
        },
      }
    : {
        kind: "price",
        list: {
          detailLink: { selector: "a.product", attribute: "href" },
          maxItems: 25,
        },
        detail: {
          name: { selector: "h1" },
          price: { selector: ".price" },
          currency: "usd",
          volume: { selector: ".volume" },
        },
      };
}

function TestResult({ revision }: { revision: Revision }) {
  const { issues, pages } = revision.validationResult;
  return (
    <div className="mt-4 space-y-3 rounded bg-slate-950 p-3 text-sm text-slate-300">
      {issues.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-red-300">
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`}>
              {issue.field}: {issue.message}
            </li>
          ))}
        </ul>
      )}
      {pages.map((page) => (
        <div
          key={page.url}
          className="border-t border-slate-800 pt-3 first:border-0 first:pt-0"
        >
          <a className="break-all text-cyan-300" href={page.url}>
            {page.url}
          </a>
          {page.kind === "review" ? (
            <div className="mt-2">
              <div className="font-medium text-white">{page.title}</div>
              <div className="text-muted mt-1">
                {page.reviews.length} review
                {page.reviews.length === 1 ? "" : "s"}
              </div>
              <ul className="mt-2 space-y-1">
                {page.reviews.map((review, index) => (
                  <li key={`${review.name}-${index}`}>
                    {review.name}
                    {review.reviewerName ? ` · ${review.reviewerName}` : ""}
                    {review.nativeScore !== null
                      ? ` · score ${review.nativeScore.display}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="mt-2 space-y-1">
              {page.products.map((product, index) => (
                <li key={`${product.url}-${index}`}>
                  {product.name} · {product.price} {product.currency} ·{" "}
                  {product.volume} ml
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Page(props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(props.params);
  const site = ExternalSiteKeySchema.parse(siteId);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const query = orpc.externalSites.scrapeSources.list.queryOptions({
    input: { site },
  });
  const { data } = useSuspenseQuery(query);
  const source = data[0];
  if (!source) throw new Error("Parsing rules not found.");

  return (
    <ConfigEditor
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
  const [text, setText] = useState(() =>
    JSON.stringify(latest?.rules ?? defaultRules(source.kind), null, 2),
  );
  const createDraft = useMutation(
    orpc.externalSites.scrapeSources.createDraft.mutationOptions(),
  );
  const preview = useMutation(
    orpc.externalSites.scrapeSources.preview.mutationOptions(),
  );
  const activate = useMutation(
    orpc.externalSites.scrapeSources.activate.mutationOptions(),
  );
  const disable = useMutation(
    orpc.externalSites.scrapeSources.disable.mutationOptions(),
  );
  const suggest = useMutation(
    orpc.externalSites.scrapeSources.suggest.mutationOptions(),
  );
  const busy =
    createDraft.isPending ||
    preview.isPending ||
    activate.isPending ||
    disable.isPending ||
    suggest.isPending;
  const activeRevision = useMemo(
    () =>
      source.revisions.find(
        (revision) => revision.id === source.activeRevisionId,
      ),
    [source],
  );
  const canSuggest =
    source.allowLlmProcessing &&
    (!latest || latest.validationStatus === "failed");

  async function action(callback: () => Promise<void>) {
    setError(undefined);
    try {
      await callback();
      await refresh();
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 py-6">
      {error && <FormError values={[error]} />}
      <div className="rounded border border-slate-800 bg-slate-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              How Peated reads{" "}
              {source.kind === "review" ? "reviews" : "store prices"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              {activeRevision
                ? `Revision ${activeRevision.revision} is active.`
                : "No revision is active. Collection is paused."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void refresh()} disabled={busy}>
              Refresh
            </Button>
            {canSuggest && (
              <Button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await suggest.mutateAsync({ id: source.id });
                  })
                }
              >
                {latest ? "Ask AI to repair" : "Ask AI for first revision"}
              </Button>
            )}
            {source.enabled && (
              <Button
                color="danger"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await disable.mutateAsync({ id: source.id });
                  })
                }
              >
                Pause source
              </Button>
            )}
          </div>
        </div>
        <label
          className="mt-4 block font-semibold text-white"
          htmlFor="parsing-rules"
        >
          Parsing rules{" "}
          <span className="text-muted font-normal">(advanced)</span>
        </label>
        <p className="text-muted mt-1 text-sm">
          Edit these rules only when the test reads a page incorrectly.
        </p>
        <label
          className="mt-4 block font-semibold text-white"
          htmlFor="list-url"
        >
          List page
        </label>
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
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
        />
        <div className="mt-3 flex justify-end">
          <Button
            color="highlight"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await createDraft.mutateAsync({
                  id: source.id,
                  listUrl,
                  rules: ScrapeRulesSchema.parse(JSON.parse(text)),
                });
              })
            }
          >
            Save as new revision
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Revision history</h2>
        {source.revisions.length === 0 ? (
          <p className="text-muted">Save the first revision to start.</p>
        ) : (
          source.revisions.map((revision) => (
            <div
              key={revision.id}
              className="rounded border border-slate-800 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    Revision {revision.revision}
                    {revision.id === source.activeRevisionId && " · Active"}
                  </div>
                  <div className="text-muted mt-1 text-sm">
                    {revision.validationStatus === "pending"
                      ? "Not tested"
                      : revision.validationStatus === "passed"
                        ? "Test passed"
                        : "Test failed"}
                    {revision.createdWith === "ai"
                      ? " · Created with AI"
                      : " · Created by a person"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await preview.mutateAsync({
                          id: source.id,
                          revisionId: revision.id,
                        });
                      })
                    }
                  >
                    Test revision
                  </Button>
                  <Button
                    color="highlight"
                    disabled={busy || revision.validationStatus !== "passed"}
                    onClick={() =>
                      void action(async () => {
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
              {revision.validationStatus !== "pending" && (
                <TestResult revision={revision} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
