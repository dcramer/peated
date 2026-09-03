"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  ExternalReviewScoringPolicySchema,
  type ExternalReviewScoreRule,
  type ExternalReviewScoringPolicy,
  type ExternalReviewScoringSettings,
} from "@peated/server/schemas/externalReviewScoring";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { toBottleListItem } from "../../lib/bottleListItem";
import { getFormErrorMessage } from "../../lib/formHelpers";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { BottleIdentityRow } from "../bottleIdentityRow.stylex";
import { useHydrated } from "../clientOnly";
import { DataTable } from "../dataTable.stylex";
import { TextLink } from "../textLink.stylex";
import { AdminButton } from "./adminButton.stylex";
import {
  AdminFormError,
  AdminFormGrid,
  AdminSelectField,
  AdminTextField,
  AdminTextareaField,
} from "./adminForm.stylex";
import ScraperSetting from "./scraperSetting.stylex";

export type ReviewScoringPreview =
  Outputs["externalSites"]["reviewScoring"]["preview"];
type Props = {
  settings: ExternalReviewScoringSettings;
  onPreview: (
    policy: ExternalReviewScoringPolicy,
  ) => Promise<ReviewScoringPreview>;
  onSave: (
    policy: ExternalReviewScoringPolicy,
    version: number,
  ) => Promise<void>;
};

const excluded: ExternalReviewScoringPolicy = { enabled: false, rules: [] };

/** Site score setup. Each edit needs a new preview; original scores stay unchanged. */
export function ReviewScoringForm({ settings, onPreview, onSave }: Props) {
  const hydrated = useHydrated();
  const [policy, setPolicy] = useState(settings.policy ?? excluded);
  const [preview, setPreview] = useState<ReviewScoringPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [edited, setEdited] = useState(false);

  function edit(next: ExternalReviewScoringPolicy) {
    setPolicy(next);
    setPreview(undefined);
    setError(undefined);
    setSaved(false);
    setEdited(true);
  }
  function editRule(index: number, next: ExternalReviewScoreRule) {
    edit({
      ...policy,
      rules: policy.rules.map((rule, i) => (i === index ? next : rule)),
    });
  }
  async function showPreview() {
    const parsed = ExternalReviewScoringPolicySchema.safeParse(policy);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      setPreview(await onPreview(parsed.data));
    } catch (caught) {
      setError(getFormErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSave(policy, preview.version);
      setSaved(true);
      setPreview(undefined);
    } catch (caught) {
      setError(getFormErrorMessage(caught));
      setPreview(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScraperSetting
      title="Review scores"
      description="Choose how this site's scores count toward bottle scores. Original scores stay unchanged."
      action={null}
    >
      {!settings.policy && !edited ? (
        <p {...stylex.props(foundationStyles.body, styles.note)}>
          We have not reviewed how this site's scores compare yet. For now, only
          whole-number scores out of 100 count.
        </p>
      ) : null}
      {settings.recomputePending ? (
        <p role="status" {...stylex.props(foundationStyles.body, styles.note)}>
          Bottle scores have not finished updating. If this message remains,
          preview and save again.
        </p>
      ) : saved ? (
        <p role="status" {...stylex.props(foundationStyles.body, styles.note)}>
          Saved. Bottle scores are updating.
        </p>
      ) : null}
      {error ? <AdminFormError values={[error]} /> : null}
      <fieldset disabled={!hydrated || busy} {...stylex.props(styles.fields)}>
        <AdminSelectField
          name="score-inclusion"
          label="Use this site's scores"
          value={
            !settings.policy && !edited
              ? "unreviewed"
              : policy.enabled
                ? "include"
                : "exclude"
          }
          required
          options={[
            ...(!settings.policy && !edited
              ? [{ value: "unreviewed", label: "Not reviewed yet" }]
              : []),
            { value: "exclude", label: "Leave out of bottle scores" },
            { value: "include", label: "Include using the table below" },
          ]}
          onChange={(event) =>
            edit({ ...policy, enabled: event.target.value === "include" })
          }
          helpText="Leaving scores out does not hide the reviews."
        />
        {policy.enabled ? (
          <>
            {policy.rules.map((rule, index) => (
              <div key={index} {...stylex.props(styles.rule)}>
                <div {...stylex.props(styles.ruleHeading)}>
                  <h4
                    {...stylex.props(
                      foundationStyles.compactRowTitle,
                      styles.note,
                    )}
                  >
                    Score scale {index + 1}
                  </h4>
                  <AdminButton
                    variant="text"
                    onClick={() =>
                      edit({
                        ...policy,
                        rules: policy.rules.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove score scale {index + 1}
                  </AdminButton>
                </div>
                <AdminFormGrid>
                  <AdminTextField
                    label="Site scores are out of"
                    name={`scale-${index}`}
                    type="number"
                    min={1}
                    step="any"
                    value={Number.isFinite(rule.scale) ? rule.scale : ""}
                    required
                    onChange={(event) =>
                      editRule(index, {
                        ...rule,
                        scale: event.target.valueAsNumber,
                      })
                    }
                  />
                  <AdminTextField
                    label="Site's scoring guide"
                    name={`guide-${index}`}
                    type="url"
                    value={rule.guideUrl}
                    required
                    onChange={(event) =>
                      editRule(index, { ...rule, guideUrl: event.target.value })
                    }
                  />
                </AdminFormGrid>
                <AdminTextareaField
                  label="Why this comparison is fair"
                  name={`explanation-${index}`}
                  value={rule.explanation}
                  rows={2}
                  required
                  onChange={(event) =>
                    editRule(index, {
                      ...rule,
                      explanation: event.target.value,
                    })
                  }
                  helpText="Use the site's score descriptions and reviews of the same bottles as evidence."
                />
                <p {...stylex.props(foundationStyles.metadata, styles.note)}>
                  List scores from low to high. Peated fills in scores between
                  the rows and rounds to a whole number. Scores below or above
                  the table are left out.
                </p>
                {rule.points.map((point, pointIndex) => (
                  <div key={pointIndex} {...stylex.props(styles.point)}>
                    <AdminTextField
                      label={`Site score ${pointIndex + 1}`}
                      name={`source-${index}-${pointIndex}`}
                      type="number"
                      step="any"
                      min={0}
                      max={Number.isFinite(rule.scale) ? rule.scale : undefined}
                      value={Number.isFinite(point.source) ? point.source : ""}
                      required
                      onChange={(event) =>
                        editRule(index, {
                          ...rule,
                          points: rule.points.map((p, i) =>
                            i === pointIndex
                              ? { ...p, source: event.target.valueAsNumber }
                              : p,
                          ),
                        })
                      }
                    />
                    <AdminTextField
                      label={`Peated score ${pointIndex + 1}`}
                      name={`target-${index}-${pointIndex}`}
                      type="number"
                      step={1}
                      min={0}
                      max={100}
                      value={Number.isFinite(point.target) ? point.target : ""}
                      suffixLabel="/100"
                      required
                      onChange={(event) =>
                        editRule(index, {
                          ...rule,
                          points: rule.points.map((p, i) =>
                            i === pointIndex
                              ? { ...p, target: event.target.valueAsNumber }
                              : p,
                          ),
                        })
                      }
                    />
                    <AdminButton
                      variant="text"
                      aria-label={`Remove score ${pointIndex + 1} from score scale ${index + 1}`}
                      disabled={rule.points.length <= 2}
                      onClick={() =>
                        editRule(index, {
                          ...rule,
                          points: rule.points.filter(
                            (_, i) => i !== pointIndex,
                          ),
                        })
                      }
                    >
                      Remove
                    </AdminButton>
                  </div>
                ))}
                <div>
                  <AdminButton
                    disabled={rule.points.length >= 101}
                    onClick={() =>
                      editRule(index, {
                        ...rule,
                        points: [...rule.points, { source: NaN, target: NaN }],
                      })
                    }
                  >
                    Add score
                  </AdminButton>
                </div>
                <details>
                  <summary
                    {...stylex.props(
                      foundationStyles.interactive,
                      styles.dates,
                    )}
                  >
                    Limit by review date
                    {rule.from || rule.until ? " (set)" : ""}
                  </summary>
                  <AdminFormGrid>
                    <AdminTextField
                      label="Published on or after"
                      name={`from-${index}`}
                      type="date"
                      value={rule.from ?? ""}
                      onChange={(event) =>
                        editRule(index, {
                          ...rule,
                          from: event.target.value || null,
                        })
                      }
                    />
                    <AdminTextField
                      label="Published before"
                      name={`until-${index}`}
                      type="date"
                      value={rule.until ?? ""}
                      onChange={(event) =>
                        editRule(index, {
                          ...rule,
                          until: event.target.value || null,
                        })
                      }
                    />
                  </AdminFormGrid>
                  <p {...stylex.props(foundationStyles.metadata, styles.note)}>
                    Use separate dates if the site changed its scoring guide.
                    Reviews without a date cannot use a setup limited by date.
                  </p>
                </details>
              </div>
            ))}
            <div>
              <AdminButton
                disabled={policy.rules.length >= 20}
                onClick={() =>
                  edit({
                    ...policy,
                    rules: [
                      ...policy.rules,
                      {
                        scale: NaN,
                        guideUrl: "",
                        explanation: "",
                        from: null,
                        until: null,
                        points: [
                          { source: NaN, target: NaN },
                          { source: NaN, target: NaN },
                        ],
                      },
                    ],
                  })
                }
              >
                Add another scale
              </AdminButton>
            </div>
          </>
        ) : null}
        <div>
          <AdminButton
            variant={preview ? "tonal" : "accent"}
            loading={busy}
            disabled={busy || (!settings.policy && !edited)}
            onClick={() => void showPreview()}
          >
            Preview changes
          </AdminButton>
        </div>
      </fieldset>
      {preview ? (
        <div {...stylex.props(styles.preview)}>
          <h4 {...stylex.props(foundationStyles.compactRowTitle, styles.note)}>
            Preview
          </h4>
          <p {...stylex.props(foundationStyles.body, styles.note)}>
            This preview shows up to 20 reviews and 10 bottles. The site has{" "}
            {preview.totalBottles} linked{" "}
            {preview.totalBottles === 1 ? "bottle" : "bottles"}. Check low,
            middle, and high scores before including this site.
          </p>
          {preview.samples.length ? (
            <DataTable
              caption="How review scores count before and after this change"
              items={preview.samples}
              getKey={(sample) => sample.id}
              columns={[
                {
                  key: "review",
                  header: "Review",
                  cell: (sample) => (
                    <TextLink href={sample.url} size="inherit">
                      {sample.name}
                    </TextLink>
                  ),
                },
                {
                  key: "original",
                  header: "Original",
                  cell: (sample) =>
                    sample.nativeScore
                      ? `${sample.nativeScore.value}/${sample.nativeScore.scale}`
                      : "No score",
                },
                {
                  key: "before",
                  header: "Before /100",
                  cell: (sample) => sample.before.value ?? "—",
                },
                {
                  key: "after",
                  header: "After /100",
                  cell: (sample) => sample.after.value ?? "—",
                },
                {
                  key: "counts",
                  header: "Included after saving",
                  cell: (sample) => exclusionReason(sample.contribution.reason),
                },
              ]}
            />
          ) : (
            <p {...stylex.props(foundationStyles.body, styles.note)}>
              No reviews to preview yet.
            </p>
          )}
          {preview.bottles.map((row) => (
            <BottleIdentityRow
              key={row.bottle.id}
              {...toBottleListItem(row.bottle)}
              subtitle={`Before: ${summary(row.before)} · After: ${summary(row.after)}`}
            />
          ))}
          <div>
            <AdminButton
              variant="accent"
              disabled={busy}
              loading={busy}
              onClick={() => void save()}
            >
              Save score settings
            </AdminButton>
          </div>
        </div>
      ) : null}
    </ScraperSetting>
  );
}

function summary(value: { median: number | null; count: number }) {
  return `${value.median === null ? "no score" : `${value.median}/100`} (${value.count} ${value.count === 1 ? "score" : "scores"})`;
}
function exclusionReason(
  reason: ReviewScoringPreview["samples"][number]["contribution"]["reason"],
) {
  switch (reason) {
    case "no_score":
      return "No score";
    case "not_public":
      return "Review isn't public";
    case "unmatched":
      return "No current bottle match";
    case "outside_dates":
      return "Review date isn't covered";
    case "outside_range":
      return "Below or above the table";
    case "unsupported_scale":
    case "not_configured":
      return "This scale isn't set up";
    case "excluded":
      return "Site scores left out";
    case "counted":
      return "Yes";
  }
}

const styles = stylex.create({
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    borderWidth: 0,
    padding: 0,
    margin: 0,
    minWidth: 0,
  },
  note: { margin: 0, color: colors.inkMuted },
  rule: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    paddingTop: space.x4,
  },
  ruleHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.x2,
  },
  point: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr) minmax(0, 1fr) auto",
      "@media (max-width: 480px)": "minmax(0, 1fr) minmax(0, 1fr)",
    },
    alignItems: "end",
    gap: space.x2,
  },
  dates: { cursor: "pointer", paddingTop: space.x2, paddingBottom: space.x2 },
  preview: { display: "flex", flexDirection: "column", gap: space.x4 },
});
