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
  missing: "No rules found",
  rules: "Rules checked",
  not_applicable: "No check needed",
} as const;

export default function ScraperReadiness({ site }: { site: Site }) {
  const { runtime } = site;
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
      description="Sites this scraper contacts and how often it can request pages."
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
            <DefinitionList.Term>Requests</DefinitionList.Term>
            <DefinitionList.Details>
              Wait {formatDuration(target.minimumSpacingMs)} between requests ·{" "}
              {target.requestsPerWindow.toLocaleString("en-US")} requests per{" "}
              {formatDuration(target.windowMs)}
            </DefinitionList.Details>
            <DefinitionList.Term>Sites</DefinitionList.Term>
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
    </AdminSection>
  );
}
