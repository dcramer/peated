import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import {
  LoadingList,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { HistoryTimeline } from "@peated/web/components/historyTimeline.stylex";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";

import { TextLink } from "@peated/web/components/textLink.stylex";
import { foundationStyles } from "@peated/web/styles/foundations.stylex";

import {
  getEntityHistoryEvents,
  getKeyHistoryEvents,
} from "./entityHistoryData";

type EntityEventList = Outputs["entities"]["events"]["list"];

export function EntityHistoryOverview({
  aboutHref,
  entityName,
  error,
  eventList,
  pending,
  retry,
}: {
  /** When set, show key dates only and link to the full history. */
  aboutHref?: string;
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

  const results = eventList?.results ?? [];
  const events = getEntityHistoryEvents(
    aboutHref ? getKeyHistoryEvents(results) : results,
  );
  if (!events.length) return null;

  return (
    <div id="history" {...stylex.props(styles.anchor)}>
      <PageSection heading="History">
        <HistoryTimeline events={events} />
        {aboutHref ? (
          <p {...stylex.props(foundationStyles.body, styles.more)}>
            <TextLink href={aboutHref}>Read the full history</TextLink>
          </p>
        ) : null}
      </PageSection>
    </div>
  );
}

const styles = stylex.create({
  anchor: {
    scrollMarginTop: "24px",
  },
  more: {
    margin: 0,
  },
});
