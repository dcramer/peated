import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
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
        <div {...stylex.props(styles.eyebrow)}>Unsupported schema</div>
        <div {...stylex.props(styles.title)}>
          <SectionHeading>{title}</SectionHeading>
        </div>
        <p {...stylex.props(styles.copy)}>
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
        <p {...stylex.props(styles.copy)}>{getBottleCheckSummary(check)}</p>

        {clean ? (
          <p {...stylex.props(styles.copy, styles.success)}>
            No catalog changes or unresolved findings were proposed.
          </p>
        ) : null}

        {findings.length > 0 ? (
          <div {...stylex.props(styles.findings)}>
            {findings.map((finding, index) => (
              <article
                {...stylex.props(styles.finding)}
                key={`${finding.scope}:${finding.summary}:${index}`}
              >
                <p>{finding.summary}</p>
                {finding.evidenceRefs.length > 0 ? (
                  <details {...stylex.props(styles.evidence)}>
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
        <span {...stylex.props(styles.status)}>
          {getBottleCheckState(check)}
        </span>
        <SectionHeading>{title}</SectionHeading>
      </div>
      <p {...stylex.props(styles.copy)}>{getBottleCheckSummary(check)}</p>

      {clean ? (
        <div {...stylex.props(styles.copy, styles.success)}>
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
                  {...stylex.props(styles.finding)}
                  key={`${finding.scope}:${finding.summary}:${index}`}
                >
                  <p>{finding.summary}</p>
                  {finding.evidenceRefs.length > 0 ? (
                    <details {...stylex.props(styles.evidence)}>
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
  eyebrow: {
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: { marginTop: space.x2 },
  copy: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
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
    fontFamily: fonts.data,
    fontSize: "11px",
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
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  evidence: {
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
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
