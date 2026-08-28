"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  ConfiguredScraperConfigSchema,
  ExternalSiteKeySchema,
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

type Scraper = Outputs["externalSites"]["configured"]["list"][number];
type Version = Scraper["versions"][number];

function defaultConfig(collection: Scraper["collection"]) {
  return collection === "reviews"
    ? {
        engineVersion: 1,
        collection: "reviews",
        index: {
          itemLink: { selector: "a.review", attribute: "href" },
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
        engineVersion: 1,
        collection: "store_prices",
        index: {
          itemLink: { selector: "a.product", attribute: "href" },
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

function TestResult({ version }: { version: Version }) {
  const { issues, pages } = version.validationResult;
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
          {page.collection === "reviews" ? (
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
  const query = orpc.externalSites.configured.list.queryOptions({
    input: { site },
  });
  const { data } = useSuspenseQuery(query);
  const scraper = data[0];
  if (!scraper) throw new Error("Parsing rules not found.");

  return (
    <ConfigEditor
      scraper={scraper}
      refresh={async () => {
        await queryClient.invalidateQueries({ queryKey: query.queryKey });
      }}
    />
  );
}

function ConfigEditor({
  scraper,
  refresh,
}: {
  scraper: Scraper;
  refresh: () => Promise<void>;
}) {
  const orpc = useORPC();
  const [error, setError] = useState<string>();
  const latest = scraper.versions[0];
  const [text, setText] = useState(() =>
    JSON.stringify(
      latest?.config ?? defaultConfig(scraper.collection),
      null,
      2,
    ),
  );
  const createDraft = useMutation(
    orpc.externalSites.configured.createDraft.mutationOptions(),
  );
  const preview = useMutation(
    orpc.externalSites.configured.preview.mutationOptions(),
  );
  const activate = useMutation(
    orpc.externalSites.configured.activate.mutationOptions(),
  );
  const disable = useMutation(
    orpc.externalSites.configured.disable.mutationOptions(),
  );
  const generate = useMutation(
    orpc.externalSites.configured.generate.mutationOptions(),
  );
  const busy =
    createDraft.isPending ||
    preview.isPending ||
    activate.isPending ||
    disable.isPending ||
    generate.isPending;
  const activeVersion = useMemo(
    () =>
      scraper.versions.find(
        (version) => version.id === scraper.activeConfigVersionId,
      ),
    [scraper],
  );
  const canGenerate =
    scraper.allowLlmProcessing &&
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
              {scraper.collection === "reviews" ? "reviews" : "store prices"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              {activeVersion
                ? `Version ${activeVersion.version} is active.`
                : "No version is active. Collection is paused."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void refresh()} disabled={busy}>
              Refresh
            </Button>
            {canGenerate && (
              <Button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await generate.mutateAsync({ id: scraper.id });
                  })
                }
              >
                {latest ? "Ask AI to repair" : "Ask AI for first version"}
              </Button>
            )}
            {scraper.enabled && (
              <Button
                color="danger"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await disable.mutateAsync({ id: scraper.id });
                  })
                }
              >
                Pause collection
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
                  id: scraper.id,
                  config: ConfiguredScraperConfigSchema.parse(JSON.parse(text)),
                });
              })
            }
          >
            Save as new version
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Version history</h2>
        {scraper.versions.length === 0 ? (
          <p className="text-muted">Save the first version to start.</p>
        ) : (
          scraper.versions.map((version) => (
            <div
              key={version.id}
              className="rounded border border-slate-800 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    Version {version.version}
                    {version.id === scraper.activeConfigVersionId &&
                      " · Active"}
                  </div>
                  <div className="text-muted mt-1 text-sm">
                    {version.validationStatus === "pending"
                      ? "Not tested"
                      : version.validationStatus === "passed"
                        ? "Test passed"
                        : "Test failed"}
                    {version.createdWith === "ai"
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
                          id: scraper.id,
                          versionId: version.id,
                        });
                      })
                    }
                  >
                    Test version
                  </Button>
                  <Button
                    color="highlight"
                    disabled={busy || version.validationStatus !== "passed"}
                    onClick={() =>
                      void action(async () => {
                        await activate.mutateAsync({
                          id: scraper.id,
                          versionId: version.id,
                        });
                      })
                    }
                  >
                    {version.id === scraper.activeConfigVersionId
                      ? "Active"
                      : version.version < (activeVersion?.version ?? 0)
                        ? "Roll back"
                        : "Activate"}
                  </Button>
                </div>
              </div>
              {version.validationStatus !== "pending" && (
                <TestResult version={version} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
