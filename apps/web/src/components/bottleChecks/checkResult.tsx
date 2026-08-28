import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import {
  getBottleCheckFindings,
  getBottleCheckState,
  getBottleCheckSummary,
} from "./checkSummary";
import { EvidenceList } from "./operationCard";

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
        <h2 {...stylex.props(styles.title)}>{title}</h2>
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
        <h2 {...stylex.props(styles.compactTitle)}>{title}</h2>
      </div>
      <p {...stylex.props(styles.copy)}>{getBottleCheckSummary(check)}</p>

      {clean ? (
        <div {...stylex.props(styles.copy, styles.success)}>
          No catalog changes or unresolved findings were proposed.
        </div>
      ) : null}

      {findings.length > 0 ? (
        <div {...stylex.props(styles.findings)}>
          <h3 {...stylex.props(styles.compactTitle)}>Findings</h3>
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
    borderLeftWidth: "3px",
    borderLeftColor: colors.accent,
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
  title: {
    margin: 0,
    marginTop: space.x2,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 600,
  },
  compactTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 600,
  },
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
    borderRadius: "999px",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 600,
  },
  findings: {
    display: "grid",
    gap: space.x3,
    marginTop: space.x3,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
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
    color: { default: colors.inkMuted, ":hover": colors.ink },
  },
});
