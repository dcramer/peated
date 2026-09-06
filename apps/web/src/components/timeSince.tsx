"use client";

import dayjs from "dayjs";
import DayJsRelativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState, type ComponentProps } from "react";

import { formatTimestamp, useViewerTimeZone } from "./timestamp";

dayjs.extend(DayJsRelativeTime);

type TimeSinceProps = Omit<ComponentProps<"time">, "children" | "dateTime"> & {
  date: string | Date;
};

export default function TimeSince({ date, title, ...props }: TimeSinceProps) {
  const dateTime = date instanceof Date ? date.toISOString() : date;
  const timeZone = useViewerTimeZone();

  // Keep initial page output stable. Relative time starts after the page loads
  // because it depends on the browser's current clock.
  const [value, setValue] = useState(() =>
    dateTime ? formatTimestamp(dateTime, "date", "UTC") : "",
  );

  useEffect(() => {
    if (!dateTime) return;

    const update = () => setValue(dayjs(dateTime).fromNow());
    update();

    const interval = window.setInterval(update, 60000);
    return () => window.clearInterval(interval);
  }, [dateTime]);

  if (!dateTime) return null;
  return (
    <time
      dateTime={dateTime}
      title={title ?? formatTimestamp(dateTime, "dateTime", timeZone)}
      {...props}
    >
      {value}
    </time>
  );
}
