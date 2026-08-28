"use client";

import dayjs from "dayjs";
import DayJsRelativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";

dayjs.extend(DayJsRelativeTime);

const absoluteDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export default function TimeSince({
  date,
  ...props
}: { date: string | Date } & React.ComponentProps<"time">) {
  const dateTime = date instanceof Date ? date.toISOString() : date;

  // Keep the server and first client render identical. Relative time starts
  // after hydration because it depends on the browser's current clock.
  const [value, setValue] = useState(() =>
    dateTime ? absoluteDateFormatter.format(new Date(dateTime)) : "",
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
    <time dateTime={dateTime} {...props}>
      {value}
    </time>
  );
}
