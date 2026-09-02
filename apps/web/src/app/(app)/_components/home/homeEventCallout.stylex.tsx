import type { Event } from "@peated/server/types";
import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import * as stylex from "@stylexjs/stylex";

import { TextLink } from "@peated/web/components";
import DateRange from "@peated/web/components/dateRange";
import { formatEventLocation } from "@peated/web/lib/eventLocation";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

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
      <SectionHeading id={headingId}>Coming up</SectionHeading>
      <h3 {...stylex.props(styles.title)}>{event.name}</h3>
      <div {...stylex.props(styles.details)}>
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
  title: {
    margin: 0,
    marginTop: space.x3,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  details: {
    display: "flex",
    flexDirection: "column",
    gap: space.x1,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  action: {
    marginTop: space.x3,
  },
});
