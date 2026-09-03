import type { Event } from "@peated/server/types";
import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import * as stylex from "@stylexjs/stylex";

import { TextLink } from "@peated/web/components";
import DateRange from "@peated/web/components/dateRange";
import { formatEventLocation } from "@peated/web/lib/eventLocation";
import { foundationStyles } from "../../../../styles/foundations.stylex";
import { colors, space } from "../../../../styles/tokens.stylex";

export function HomeEventCallout({
  event,
  headingId = "upcoming-event",
}: {
  event: Event;
  headingId?: string;
}) {
  const location = formatEventLocation(event);

  return (
    <section aria-labelledby={headingId} {...stylex.props(styles.root)}>
      <SectionHeading id={headingId}>{event.name}</SectionHeading>
      <div {...stylex.props(foundationStyles.metadata, styles.details)}>
        <DateRange start={event.dateStart} end={event.dateEnd} />
        {location ? <span>{location}</span> : null}
      </div>
      <div {...stylex.props(styles.action)}>
        <TextLink href="/events">
          View whisky events <span aria-hidden="true">→</span>
        </TextLink>
      </div>
    </section>
  );
}

const styles = stylex.create({
  root: {
    minWidth: 0,
  },
  details: {
    display: "flex",
    flexDirection: "column",
    gap: space.x1,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  action: {
    marginTop: space.x3,
  },
});
