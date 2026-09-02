import type { Event } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { ButtonLink, TextLink } from "@peated/web/components";
import DateRange from "@peated/web/components/dateRange";
import { colors, fonts, space } from "../../../styles/tokens.stylex";

export function EventList({ events }: { events: Event[] }) {
  return (
    <div {...stylex.props(styles.list)}>
      {events.map((event) => {
        const location = [event.address, event.country?.name]
          .filter(Boolean)
          .join(" · ");
        return (
          <article key={event.id} {...stylex.props(styles.event)}>
            <div {...stylex.props(styles.date)}>
              <DateRange start={event.dateStart} end={event.dateEnd} />
            </div>
            <div {...stylex.props(styles.details)}>
              <h3 {...stylex.props(styles.name)}>
                {event.website ? (
                  <TextLink
                    href={event.website}
                    rel="noreferrer"
                    size="inherit"
                    target="_blank"
                  >
                    {event.name}
                  </TextLink>
                ) : (
                  event.name
                )}
              </h3>
              {location ? (
                <div {...stylex.props(styles.location)}>{location}</div>
              ) : null}
            </div>
            <div {...stylex.props(styles.action)}>
              <ButtonLink
                download
                href={`/events/${event.id}/calendar.ics`}
                size="sm"
                variant="tonal"
              >
                Add to calendar
              </ButtonLink>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const NARROW = "@media (max-width: 639px)";

const styles = stylex.create({
  list: {
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  event: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr) auto",
    gap: space.x6,
    alignItems: "baseline",
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x2,
    },
  },
  date: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
  },
  details: { minWidth: 0 },
  name: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 650,
    lineHeight: 1.25,
  },
  location: {
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.4,
  },
  action: { whiteSpace: "nowrap" },
});
