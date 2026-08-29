import type { Outputs } from "@peated/server/orpc/router";
import TimeSince from "@peated/web/components/timeSince";
import { formatDuration } from "@peated/web/lib/format";

import { AdminDetails, AdminSection, AdminStatus } from "./adminContent.stylex";
import { AdminDefinitionList as DefinitionList } from "./adminUtility.stylex";

type Site = Outputs["externalSites"]["healthDetails"];

function TargetStatus({
  blockedUntil,
  coolingDown,
  enabled,
}: {
  blockedUntil: string | null;
  coolingDown: boolean;
  enabled: boolean;
}) {
  if (!enabled) return <AdminStatus tone="danger">Disabled</AdminStatus>;
  if (blockedUntil && coolingDown) {
    return (
      <AdminStatus tone="warning">
        Cooling down · <TimeSince date={blockedUntil} />
      </AdminStatus>
    );
  }
  return <AdminStatus tone="success">Enabled</AdminStatus>;
}

const robotsLabels = {
  unknown: "Not checked",
  missing: "No published rules",
  rules: "Rules checked",
  not_applicable: "No check needed",
} as const;

export default function ScraperReadiness({ site }: { site: Site }) {
  const { runtime, reviewPolicy } = site;
  const synchronized =
    runtime.targets.length === runtime.targetKeys.length &&
    runtime.targetKeys.every((key) =>
      runtime.targets.some((target) => target.key === key),
    );
  const status = !runtime.registered ? (
    <AdminStatus tone="danger">Not ready</AdminStatus>
  ) : !synchronized ? (
    <AdminStatus tone="warning">Setup incomplete</AdminStatus>
  ) : (
    <AdminStatus tone="success">Ready</AdminStatus>
  );

  return (
    <AdminSection
      title="Connection"
      description="Request limits and access checks for this site."
      action={status}
    >
      {runtime.targets.map((target) => (
        <AdminDetails
          key={target.key}
          summary={
            <>
              {target.key} ·{" "}
              <TargetStatus
                enabled={target.enabled}
                blockedUntil={target.blockedUntil}
                coolingDown={target.coolingDown}
              />
            </>
          }
        >
          <DefinitionList>
            <DefinitionList.Term>Rate</DefinitionList.Term>
            <DefinitionList.Details>
              {formatDuration(target.minimumSpacingMs)} spacing ·{" "}
              {target.requestsPerWindow.toLocaleString("en-US")} requests /{" "}
              {formatDuration(target.windowMs)}
            </DefinitionList.Details>
            <DefinitionList.Term>Origins</DefinitionList.Term>
            <DefinitionList.Details>
              {target.origins.map((origin, index) => (
                <span key={origin.origin}>
                  {index ? " · " : null}
                  {origin.origin} ({robotsLabels[origin.robotsStatus]}
                  {origin.robotsFetchedAt ? (
                    <>
                      ; checked <TimeSince date={origin.robotsFetchedAt} />
                    </>
                  ) : null}
                  )
                </span>
              ))}
            </DefinitionList.Details>
          </DefinitionList>
        </AdminDetails>
      ))}
      {reviewPolicy ? (
        <AdminDetails summary="Review policy">
          <DefinitionList>
            <DefinitionList.Term>Publication</DefinitionList.Term>
            <DefinitionList.Details>
              {reviewPolicy.publicationMode.replace("_", " ")}
            </DefinitionList.Details>
            <DefinitionList.Term>LLM processing</DefinitionList.Term>
            <DefinitionList.Details>
              {reviewPolicy.allowLlmProcessing ? "Allowed" : "Blocked"}
            </DefinitionList.Details>
            <DefinitionList.Term>Scores</DefinitionList.Term>
            <DefinitionList.Details>
              {reviewPolicy.allowScoreDisplay ? "Visible" : "Hidden"}
            </DefinitionList.Details>
            <DefinitionList.Term>Summaries</DefinitionList.Term>
            <DefinitionList.Details>
              {reviewPolicy.allowSummaryDisplay ? "Visible" : "Hidden"}
            </DefinitionList.Details>
          </DefinitionList>
        </AdminDetails>
      ) : null}
    </AdminSection>
  );
}
