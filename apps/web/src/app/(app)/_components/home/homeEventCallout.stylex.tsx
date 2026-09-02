import type { Event } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { ButtonLink } from "@peated/web/components";
import DateRange from "@peated/web/components/dateRange";
import { formatEventLocation } from "@peated/web/lib/eventLocation";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

export function HomeEventCallout({ event }: { event: Event }) {
  const location = formatEventLocation(event);

  return (
    <section aria-labelledby="upcoming-event" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.copy)}>
        <div {...stylex.props(styles.eyebrow)}>Coming up</div>
        <h2 id="upcoming-event" {...stylex.props(styles.title)}>
          {event.name}
        </h2>
        <div {...stylex.props(styles.details)}>
          <DateRange start={event.dateStart} end={event.dateEnd} />
          {location ? <span>{location}</span> : null}
        </div>
      </div>
      <ButtonLink href="/events" size="sm" variant="accent">
        View whisky events
      </ButtonLink>
    </section>
  );
}

const NARROW = "@media (max-width: 639px)";

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x6,
    padding: space.x6,
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentTint,
    [NARROW]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: space.x4,
    },
  },
  copy: { minWidth: 0 },
  eyebrow: {
    marginBottom: space.x1,
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  details: {
    display: "flex",
    flexWrap: "wrap",
    gap: `${space.x1} ${space.x3}`,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
  },
});
