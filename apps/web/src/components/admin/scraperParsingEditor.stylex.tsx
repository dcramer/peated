"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { ScrapeRulesSchema } from "@peated/server/schemas";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { getFormErrorMessage } from "../../lib/formHelpers";
import { useORPC } from "../../lib/orpc/context";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
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
import {
  canSuggestScrapeRules,
  getSetupAfterLatestVersion,
  getSetupDescription,
  getSetupSteps,
  needsScrapeRulesUpdate,
} from "./scraperParsingStatus";
import { ScraperPreviewResult } from "./scraperPreviewResult.stylex";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];
type Revision = Source["revisions"][number];

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

export function ScraperParsingEditor({
  source,
  refresh,
}: {
  source: Source;
  refresh: () => Promise<void>;
}) {
  const orpc = useORPC();
  const [error, setError] = useState<string>();
  const [activePreview, setActivePreview] = useState<{
    revisionId: number;
    runId: number;
  }>();
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
  const previewRuns = useQuery({
    ...orpc.externalSites.runs.queryOptions({
      input: { site: source.site.type, cursor: 1, limit: 20 },
    }),
    enabled: activePreview !== undefined,
    refetchInterval: ({ state }) => {
      if (!activePreview) return false;
      const run = state.data?.results.find(
        (item) => item.id === activePreview.runId,
      );
      return !run || run.status === "queued" || run.status === "running"
        ? 2_000
        : false;
    },
  });
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
    activePreview !== undefined ||
    activate.isPending ||
    pause.isPending ||
    suggest.isPending;
  const activeRevision = source.revisions.find(
    (revision) => revision.id === source.activeRevisionId,
  );
  const setup = getSetupAfterLatestVersion(source);
  const needsRulesUpdate = needsScrapeRulesUpdate(source);
  const canSuggest = canSuggestScrapeRules(source);
  const setupSteps = getSetupSteps(source);
  const setupDescription = getSetupDescription(source);
  const previewRevisionId =
    activePreview?.revisionId ??
    (preview.isPending ? preview.variables?.revisionId : undefined);

  useEffect(() => {
    if (!activePreview) return;
    if (previewRuns.error && !previewRuns.isFetching) {
      // Preview runs in the worker. Stop waiting if its status cannot be read.
      // oxlint-disable-next-line react/set-state-in-effect
      setError(getFormErrorMessage(previewRuns.error));
      setActivePreview(undefined);
      return;
    }
    const run = previewRuns.data?.results.find(
      (item) => item.id === activePreview.runId,
    );
    if (!run || run.status === "queued" || run.status === "running") return;

    if (run.status === "failed") {
      setError(run.error ?? "Preview failed.");
    }
    setActivePreview(undefined);
    void (async () => {
      try {
        await refresh();
      } catch (error) {
        setError(getFormErrorMessage(error));
      }
    })();
  }, [
    activePreview,
    previewRuns.data,
    previewRuns.error,
    previewRuns.isFetching,
    refresh,
  ]);

  async function runAndRefresh(callback: () => Promise<void>) {
    setError(undefined);
    try {
      await callback();
      await refresh();
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  async function startPreview(revisionId: number) {
    setError(undefined);
    try {
      const run = await preview.mutateAsync({
        id: source.id,
        revisionId,
      });
      setActivePreview({ revisionId, runId: run.id });
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  return (
    <div {...stylex.props(styles.stack)}>
      {error ? <AdminFormError values={[error]} /> : null}
      <AdminSection
        title="Setup progress"
        description={setupDescription}
        action={
          canSuggest ? (
            <AdminButton
              disabled={busy}
              loading={suggest.isPending}
              onClick={() =>
                void runAndRefresh(async () => {
                  await suggest.mutateAsync({ id: source.id });
                })
              }
            >
              {needsRulesUpdate
                ? "Update parsing rules"
                : latest
                  ? latest.previewStatus === "failed"
                    ? "Ask AI to repair"
                    : "Rebuild setup"
                  : setup
                    ? "Retry AI setup"
                    : "Start AI setup"}
            </AdminButton>
          ) : undefined
        }
      >
        <ol {...stylex.props(styles.setupList)}>
          {setupSteps.map((step) => (
            <li key={step.name} {...stylex.props(styles.setupStep)}>
              <span
                {...stylex.props(
                  foundationStyles.interactiveSmall,
                  styles.setupStepName,
                )}
              >
                {step.name}
              </span>
              <AdminStatus tone={step.tone}>{step.status}</AdminStatus>
            </li>
          ))}
        </ol>
        {setup?.error ? (
          <p {...stylex.props(foundationStyles.metadata, styles.setupError)}>
            {setup.error}
          </p>
        ) : null}
      </AdminSection>
      {latest ? (
        <AdminSection
          title={`How Peated reads ${source.kind === "review" ? "reviews" : source.kind === "catalog" ? "catalog products" : "store prices"}`}
          description={
            activeRevision && source.enabled
              ? `Version ${activeRevision.revision} is active.`
              : activeRevision
                ? `Collection is paused. Version ${activeRevision.revision} is ready to resume.`
                : "Collection is paused until you activate a version."
          }
          action={
            <AdminActions>
              <AdminButton onClick={() => void refresh()} disabled={busy}>
                Refresh
              </AdminButton>
              {source.enabled ? (
                <AdminButton
                  variant="danger"
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
          <AdminDetails summary="Edit site setup (advanced)">
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
                helpText="Edit these rules only when the test reads a page incorrectly."
                format="data"
                rows={18}
                value={rulesText}
                onChange={(event) => setRulesText(event.target.value)}
                spellCheck={false}
                required
              />
              <AdminActions>
                <AdminButton
                  variant="accent"
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
                </AdminButton>
              </AdminActions>
            </div>
          </AdminDetails>
        </AdminSection>
      ) : null}

      <AdminSection title="Versions">
        {source.revisions.length === 0 ? (
          <AdminEmptyActivity>
            {setup?.status === "queued" || setup?.status === "running"
              ? "AI setup is running. The first version will appear here."
              : setup?.status === "succeeded"
                ? "The first version is loading."
                : setup?.status === "failed"
                  ? "No version was created. Retry AI setup after you review the error."
                  : "Start AI setup to create the first version."}
          </AdminEmptyActivity>
        ) : (
          <div {...stylex.props(styles.revisionList)}>
            {source.revisions.map((revision) => (
              <AdminDetails
                key={revision.id}
                summary={
                  <span {...stylex.props(styles.revisionSummary)}>
                    <span>
                      Version {revision.revision}
                      {revision.id === source.activeRevisionId
                        ? source.enabled
                          ? " · Active"
                          : " · Paused"
                        : ""}
                    </span>
                    <AdminStatus tone={revisionTone(revision.previewStatus)}>
                      {revisionLabel(revision.previewStatus)}
                    </AdminStatus>
                    <span {...stylex.props(styles.muted)}>
                      {revision.author === "ai"
                        ? "Created with AI"
                        : "Created by a person"}
                      {` · Rules v${revision.rulesVersion}`}
                    </span>
                  </span>
                }
              >
                <div {...stylex.props(styles.revisionBody)}>
                  <AdminActions>
                    <AdminButton
                      disabled={busy}
                      loading={previewRevisionId === revision.id}
                      onClick={() => void startPreview(revision.id)}
                    >
                      {previewRevisionId === revision.id
                        ? "Testing pages…"
                        : "Test version"}
                    </AdminButton>
                    <AdminButton
                      variant="accent"
                      disabled={
                        busy ||
                        revision.previewStatus !== "passed" ||
                        (source.enabled &&
                          revision.id === source.activeRevisionId)
                      }
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
                        ? source.enabled
                          ? "Active"
                          : "Resume collection"
                        : revision.revision < (activeRevision?.revision ?? 0)
                          ? "Roll back"
                          : "Activate"}
                    </AdminButton>
                  </AdminActions>
                  {previewRevisionId === revision.id ? (
                    <p
                      {...stylex.props(
                        foundationStyles.metadata,
                        styles.previewStatus,
                      )}
                      role="status"
                    >
                      The test is running. Results will appear here when it
                      finishes.
                    </p>
                  ) : null}
                  {revision.previewStatus !== "pending" ? (
                    <ScraperPreviewResult result={revision.previewResult} />
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
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: space.x6,
  },
  setupList: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 639px)": "1fr",
    },
    gap: space.x3,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  setupStep: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    padding: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
  },
  setupStepName: {
    color: colors.ink,
    fontWeight: 600,
  },
  setupError: {
    marginTop: space.x4,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.accentDeep,
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
  previewStatus: {
    margin: 0,
    color: colors.inkMuted,
  },
  muted: { color: colors.inkMuted },
});
