"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { ScrapeRulesSchema } from "@peated/server/schemas";
import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { getFormErrorMessage } from "../../lib/formHelpers";
import { useORPC } from "../../lib/orpc/context";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { AdminButton } from "./adminButton.stylex";
import {
  AdminActions,
  AdminDetails,
  AdminSection,
  AdminStatus,
} from "./adminContent.stylex";
import {
  AdminFormError,
  AdminTextareaField,
  AdminTextField,
} from "./adminForm.stylex";
import { AdminEmptyActivity } from "./adminUtility.stylex";

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

function revisionTone(status: Revision["previewStatus"]) {
  if (status === "passed") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "neutral" as const;
}

function revisionLabel(status: Revision["previewStatus"]) {
  if (status === "passed") return "Test passed";
  if (status === "failed") return "Test failed";
  return "Not tested";
}

function TestResult({ revision }: { revision: Revision }) {
  const { issues, pages } = revision.previewResult;

  return (
    <div {...stylex.props(styles.results)}>
      {issues.length > 0 ? (
        <ul {...stylex.props(styles.issueList)}>
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`}>
              {issue.field}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div {...stylex.props(styles.pageList)}>
        {pages.map((page) => (
          <article key={page.url} {...stylex.props(styles.resultPage)}>
            <a
              href={page.url}
              rel="noreferrer"
              target="_blank"
              {...stylex.props(styles.resultLink)}
            >
              {page.url}
            </a>
            {page.kind === "review" ? (
              <div {...stylex.props(styles.resultBody)}>
                <strong {...stylex.props(styles.resultTitle)}>
                  {page.title}
                </strong>
                <span {...stylex.props(styles.muted)}>
                  {page.reviews.length} review
                  {page.reviews.length === 1 ? "" : "s"}
                </span>
                <ul {...stylex.props(styles.itemList)}>
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
              <ul {...stylex.props(styles.itemList)}>
                {page.products.map((product, index) => (
                  <li key={`${product.url}-${index}`}>
                    {product.name} ·{" "}
                    {(product.price / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: product.currency,
                    })}{" "}
                    · {product.volume} ml
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export function ScraperParsingEditor({
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
    JSON.stringify(latest?.rules ?? defaultRules(source.kind), null, 2),
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
  const canSuggest = !latest || latest.previewStatus === "failed";

  async function runAndRefresh(callback: () => Promise<void>) {
    setError(undefined);
    try {
      await callback();
      await refresh();
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  return (
    <div {...stylex.props(styles.stack)}>
      {error ? <AdminFormError values={[error]} /> : null}
      <AdminSection
        title={`How Peated reads ${source.kind === "review" ? "reviews" : "store prices"}`}
        description={
          activeRevision
            ? `Revision ${activeRevision.revision} is active.`
            : "No revision is active. Collection is paused."
        }
        action={
          <AdminActions>
            <AdminButton onClick={() => void refresh()} disabled={busy}>
              Refresh
            </AdminButton>
            {canSuggest ? (
              <AdminButton
                disabled={busy}
                onClick={() =>
                  void runAndRefresh(async () => {
                    await suggest.mutateAsync({ id: source.id });
                  })
                }
              >
                {latest ? "Ask AI to repair" : "Retry AI setup"}
              </AdminButton>
            ) : null}
            {source.enabled ? (
              <AdminButton
                color="danger"
                disabled={busy}
                onClick={() =>
                  void runAndRefresh(async () => {
                    await pause.mutateAsync({ id: source.id });
                  })
                }
              >
                Pause collection
              </AdminButton>
            ) : null}
          </AdminActions>
        }
      >
        <div {...stylex.props(styles.formStack)}>
          <AdminTextField
            id="list-url"
            label="List page"
            type="url"
            value={listUrl}
            onChange={(event) => setListUrl(event.target.value)}
            required
          />
          <AdminTextareaField
            id="parsing-rules"
            label="Parsing rules"
            helpText="Advanced: edit these rules only when the test reads a page incorrectly."
            format="data"
            rows={18}
            value={rulesText}
            onChange={(event) => setRulesText(event.target.value)}
            spellCheck={false}
            required
          />
          <AdminActions>
            <AdminButton
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
              Save as new revision
            </AdminButton>
          </AdminActions>
        </div>
      </AdminSection>

      <AdminSection title="Revision history">
        {source.revisions.length === 0 ? (
          <AdminEmptyActivity>
            AI setup is running. Generated rules will appear here. Use Retry AI
            setup if the run failed.
          </AdminEmptyActivity>
        ) : (
          <div {...stylex.props(styles.revisionList)}>
            {source.revisions.map((revision) => (
              <AdminDetails
                key={revision.id}
                summary={
                  <span {...stylex.props(styles.revisionSummary)}>
                    <span>
                      Revision {revision.revision}
                      {revision.id === source.activeRevisionId
                        ? " · Active"
                        : ""}
                    </span>
                    <AdminStatus tone={revisionTone(revision.previewStatus)}>
                      {revisionLabel(revision.previewStatus)}
                    </AdminStatus>
                    <span {...stylex.props(styles.muted)}>
                      {revision.author === "ai"
                        ? "Created with AI"
                        : "Created by a person"}
                    </span>
                  </span>
                }
              >
                <div {...stylex.props(styles.revisionBody)}>
                  <AdminActions>
                    <AdminButton
                      disabled={busy}
                      onClick={() =>
                        void runAndRefresh(async () => {
                          await preview.mutateAsync({
                            id: source.id,
                            revisionId: revision.id,
                          });
                        })
                      }
                    >
                      Test revision
                    </AdminButton>
                    <AdminButton
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
                    </AdminButton>
                  </AdminActions>
                  {revision.previewStatus !== "pending" ? (
                    <TestResult revision={revision} />
                  ) : null}
                </div>
              </AdminDetails>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}

const styles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: space.x6,
    paddingTop: space.x6,
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: space.x6,
  },
  revisionList: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
  },
  revisionSummary: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.x3,
  },
  revisionBody: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
  },
  results: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    padding: space.x4,
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
  issueList: {
    margin: 0,
    paddingLeft: space.x6,
    color: colors.accentDeep,
  },
  pageList: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
  },
  resultPage: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  resultLink: {
    color: colors.accentDeep,
    overflowWrap: "anywhere",
  },
  resultBody: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
  },
  resultTitle: { color: colors.ink },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: space.x1,
    margin: 0,
    paddingLeft: space.x6,
  },
  muted: { color: colors.inkMuted },
});
