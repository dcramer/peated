import type { Event } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import {
  ButtonLink,
  LoadingPlaceholder,
  TextLink,
} from "@peated/web/components";
import DateRange from "@peated/web/components/dateRange";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../../styles/tokens.stylex";

const loadingRows = [0, 1, 2, 3] as const;

export function EventList({ events }: { events: Event[] }) {
  return (
    <div {...stylex.props(styles.list)}>
      {events.map((event) => {
        const location = [event.address, event.country?.name]
          .filter(Boolean)
          .join(" · ");
        return (
          <article key={event.id} {...stylex.props(styles.event)}>
            <div {...stylex.props(foundationStyles.metadata, styles.date)}>
              <DateRange start={event.dateStart} end={event.dateEnd} />
            </div>
            <div {...stylex.props(styles.details)}>
              <h3 {...stylex.props(foundationStyles.rowTitle, styles.name)}>
                {event.website ? (
                  <TextLink
                    href={event.website}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.name}
                  </TextLink>
                ) : (
                  event.name
                )}
              </h3>
              {location ? (
                <div
                  {...stylex.props(foundationStyles.metadata, styles.location)}
                >
                  {location}
                </div>
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

export function EventListLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading events"
      role="status"
      {...stylex.props(styles.list)}
    >
      {loadingRows.slice(0, 3).map((delay) => (
        <div aria-hidden="true" key={delay} {...stylex.props(styles.event)}>
          <LoadingPlaceholder delay={delay} preset="metadata" />
          <div {...stylex.props(styles.loadingDetails)}>
            <LoadingPlaceholder delay={delay} preset="text" />
            <LoadingPlaceholder
              delay={loadingRows[(delay + 1) % loadingRows.length]}
              preset="metadata"
            />
          </div>
          <span {...stylex.props(styles.loadingAction)} />
        </div>
      ))}
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
  },
  details: { minWidth: 0 },
  name: {
    margin: 0,
    color: colors.ink,
  },
  location: {
    marginTop: space.x1,
    color: colors.inkMuted,
  },
  action: { whiteSpace: "nowrap" },
  loadingDetails: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  loadingAction: {
    display: "block",
    width: "112px",
    height: "34px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
});
