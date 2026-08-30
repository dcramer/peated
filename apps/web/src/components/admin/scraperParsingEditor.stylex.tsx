"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { ScrapeRulesSchema } from "@peated/server/schemas";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
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
import { getSetupAfterLatestVersion } from "./scraperParsingStatus";
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
  const canSuggest =
    (!setup || setup.status === "failed") &&
    (!latest || latest.previewStatus === "failed");
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
              {latest
                ? "Ask AI to repair"
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
              <span {...stylex.props(styles.setupStepName)}>{step.name}</span>
              <AdminStatus tone={step.tone}>{step.status}</AdminStatus>
            </li>
          ))}
        </ol>
        {setup?.error ? (
          <p {...stylex.props(styles.setupError)}>{setup.error}</p>
        ) : null}
      </AdminSection>
      {latest ? (
        <AdminSection
          title={`How Peated reads ${source.kind === "review" ? "reviews" : "store prices"}`}
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
                      color="highlight"
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
                    <p {...stylex.props(styles.previewStatus)} role="status">
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

function getSetupSteps(source: Source) {
  const latest = source.revisions[0];
  const setupStatus = getSetupAfterLatestVersion(source)?.status;
  const setupComplete =
    Boolean(latest) && (!setupStatus || setupStatus === "succeeded");

  return [
    {
      name: "AI setup",
      status:
        setupStatus === "running"
          ? "Running"
          : setupStatus === "failed"
            ? "Needs attention"
            : setupStatus === "queued"
              ? "Queued"
              : latest
                ? "Complete"
                : "Not started",
      tone: setupComplete
        ? ("success" as const)
        : setupStatus === "failed"
          ? ("danger" as const)
          : ("neutral" as const),
    },
    {
      name: "Preview",
      status: !latest
        ? "Waiting"
        : latest.previewStatus === "passed"
          ? "Passed"
          : latest.previewStatus === "failed"
            ? "Needs repair"
            : "Ready",
      tone:
        latest?.previewStatus === "passed"
          ? ("success" as const)
          : latest?.previewStatus === "failed"
            ? ("danger" as const)
            : ("neutral" as const),
    },
    {
      name: "Activate",
      status: source.enabled
        ? "Active"
        : source.activeRevisionId
          ? "Paused"
          : "Waiting",
      tone: source.enabled ? ("success" as const) : ("neutral" as const),
    },
  ];
}

function getSetupDescription(source: Source) {
  const hasRevision = source.revisions.length > 0;
  const setup = getSetupAfterLatestVersion(source);

  if (setup?.status === "running") {
    return hasRevision
      ? "Peated is updating this site's setup."
      : "Peated is finding the pages and information to collect.";
  }
  if (setup?.status === "queued") {
    return "Setup will start shortly. This page refreshes automatically.";
  }
  if (setup?.status === "failed") {
    return "AI could not finish setup. Review the reason, then retry when the site is available.";
  }
  if (setup?.status === "succeeded") {
    return hasRevision
      ? "The generated setup is ready to test."
      : "The generated version is loading.";
  }
  const latest = source.revisions[0];
  if (latest?.previewStatus === "failed") {
    return "The latest version needs repair.";
  }
  if (latest?.previewStatus === "passed") {
    return source.enabled
      ? "Setup is complete."
      : "The tested version is ready to activate.";
  }
  if (latest) return "The generated setup is ready to test.";
  return "Start AI setup to create the first version.";
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
      default: "repeat(3, minmax(0, 1fr))",
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
    backgroundColor: colors.inset,
  },
  setupStepName: {
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
  },
  setupError: {
    marginTop: space.x4,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
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
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
  muted: { color: colors.inkMuted },
});
