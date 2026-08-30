import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import {
  HistoryTimeline,
  LoadingList,
  SectionError,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";

import { getEntityHistoryEvents } from "./entityHistoryData";

type EntityEventList = Outputs["entities"]["events"]["list"];

export function EntityHistoryOverview({
  entityName,
  error,
  eventList,
  pending,
  retry,
}: {
  entityName: string;
  error: boolean;
  eventList?: EntityEventList;
  pending: boolean;
  retry: () => void;
}) {
  if (pending) {
    return (
      <div id="history" {...stylex.props(styles.anchor)}>
        <PageSection heading="History">
          <LoadingList label={`Loading ${entityName} history`} rows={4} />
        </PageSection>
      </div>
    );
  }

  if (error) {
    return (
      <div id="history" {...stylex.props(styles.anchor)}>
        <PageSection heading="History">
          <SectionError heading="History is unavailable" onRetry={retry}>
            The rest of this record still works. Try loading its history again.
          </SectionError>
        </PageSection>
      </div>
    );
  }

  const events = getEntityHistoryEvents(eventList?.results ?? []);
  if (!events.length) return null;

  return (
    <div id="history" {...stylex.props(styles.anchor)}>
      <PageSection heading="History">
        <HistoryTimeline events={events} />
      </PageSection>
    </div>
  );
}

const styles = stylex.create({
  anchor: {
    scrollMarginTop: "24px",
  },
});
