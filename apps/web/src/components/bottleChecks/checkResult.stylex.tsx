import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../styles/tokens.stylex";
import { SectionHeading } from "../sectionHeading.stylex";
import {
  getBottleCheckFindings,
  getBottleCheckState,
  getBottleCheckSummary,
} from "./checkSummary.stylex";
import { EvidenceList } from "./operationCard.stylex";

type Check = Outputs["audits"]["details"]["audit"];

export default function CheckResult({
  check,
  compact = false,
  title = "Audit result",
}: {
  check: Check;
  compact?: boolean;
  title?: string;
}) {
  if (!check.schemaSupported) {
    return (
      <section {...stylex.props(styles.panel, styles.warningPanel)}>
        <div {...stylex.props(foundationStyles.fieldLabel, styles.label)}>
          Unsupported schema
        </div>
        <div {...stylex.props(styles.title)}>
          <SectionHeading>{title}</SectionHeading>
        </div>
        <p {...stylex.props(foundationStyles.body, styles.copy)}>
          This audit uses schema version {check.schemaVersion}. Its historical
          proposals cannot be reviewed safely
          {check.canClose
            ? ", but the audit can be closed."
            : ". It cannot be closed while an operation is applying."}
        </p>
      </section>
    );
  }

  const findings = getBottleCheckFindings(check);
  const clean = check.operations.length === 0 && findings.length === 0;

  if (compact) {
    return (
      <section aria-label="Review summary" {...stylex.props(styles.panel)}>
        <p {...stylex.props(foundationStyles.body, styles.copy)}>
          {getBottleCheckSummary(check)}
        </p>

        {clean ? (
          <p
            {...stylex.props(
              foundationStyles.body,
              styles.copy,
              styles.success,
            )}
          >
            No catalog changes or unresolved findings were proposed.
          </p>
        ) : null}

        {findings.length > 0 ? (
          <div {...stylex.props(styles.findings)}>
            {findings.map((finding, index) => (
              <article
                {...stylex.props(foundationStyles.body, styles.finding)}
                key={`${finding.scope}:${finding.summary}:${index}`}
              >
                <p>{finding.summary}</p>
                {finding.evidenceRefs.length > 0 ? (
                  <details
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.evidence,
                    )}
                  >
                    <summary {...stylex.props(styles.summary)}>
                      Evidence
                    </summary>
                    <EvidenceList evidence={finding.evidenceRefs} />
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.heading)}>
        <span {...stylex.props(foundationStyles.metadata, styles.status)}>
          {getBottleCheckState(check)}
        </span>
        <SectionHeading>{title}</SectionHeading>
      </div>
      <p {...stylex.props(foundationStyles.body, styles.copy)}>
        {getBottleCheckSummary(check)}
      </p>

      {clean ? (
        <div
          {...stylex.props(foundationStyles.body, styles.copy, styles.success)}
        >
          No catalog changes or unresolved findings were proposed.
        </div>
      ) : null}

      {findings.length > 0 ? (
        <div {...stylex.props(styles.findings)}>
          <SectionHeading level={3}>Findings</SectionHeading>
          <div {...stylex.props(styles.findingList)}>
            {findings.map((finding, index) => {
              return (
                <article
                  {...stylex.props(foundationStyles.body, styles.finding)}
                  key={`${finding.scope}:${finding.summary}:${index}`}
                >
                  <p>{finding.summary}</p>
                  {finding.evidenceRefs.length > 0 ? (
                    <details
                      {...stylex.props(
                        foundationStyles.metadata,
                        styles.evidence,
                      )}
                    >
                      <summary {...stylex.props(styles.summary)}>
                        Evidence
                      </summary>
                      <EvidenceList evidence={finding.evidenceRefs} />
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const styles = stylex.create({
  panel: {
    boxSizing: "border-box",
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: "3px",
    backgroundColor: colors.surface,
  },
  warningPanel: {
    padding: space.x6,
    borderColor: colors.accent,
    backgroundColor: colors.accentTint,
  },
  label: {
    color: colors.accentDeep,
  },
  title: { marginTop: space.x2 },
  copy: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  success: { color: colors.ink },
  heading: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  status: {
    padding: "4px 10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    color: colors.ink,
    fontWeight: 600,
  },
  findings: {
    display: "grid",
    gap: space.x3,
    marginTop: space.x3,
  },
  findingList: { display: "grid", gap: space.x3 },
  finding: {
    color: colors.inkMuted,
  },
  evidence: {
    marginTop: space.x1,
    color: colors.inkMuted,
  },
  summary: {
    cursor: "pointer",
    outline: "none",
    color: { default: colors.inkMuted, ":hover": colors.ink },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
