"use client";

import { useSyncExternalStore, type ComponentProps } from "react";

export type TimestampFormat =
  | "date"
  | "dateLong"
  | "dateTime"
  | "monthDay"
  | "monthYear";

export type TimestampProps = Omit<
  ComponentProps<"time">,
  "children" | "dateTime"
> & {
  date: string | Date;
  format?: TimestampFormat;
};

const formats = {
  date: {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  dateLong: {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
  dateTime: {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  },
  monthDay: {
    day: "numeric",
    month: "short",
  },
  monthYear: {
    month: "long",
    year: "numeric",
  },
} satisfies Record<TimestampFormat, Intl.DateTimeFormatOptions>;

const fullFormat: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "long",
};

const subscribe = () => () => undefined;
const getServerTimeZone = () => "UTC";
const getViewerTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function formatTimestamp(
  date: string | Date,
  format: TimestampFormat,
  timeZone: string,
) {
  return new Intl.DateTimeFormat("en-US", {
    ...formats[format],
    timeZone,
  }).format(new Date(date));
}

function formatTimestampTitle(date: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    ...fullFormat,
    timeZone,
  }).format(new Date(date));
}

export function useViewerTimeZone() {
  return useSyncExternalStore(subscribe, getViewerTimeZone, getServerTimeZone);
}

/** Shows an absolute timestamp in the viewer's timezone after the page loads. */
export function Timestamp({
  date,
  format = "dateTime",
  title,
  ...props
}: TimestampProps) {
  const timeZone = useViewerTimeZone();
  const dateTime = date instanceof Date ? date.toISOString() : date;

  return (
    <time
      dateTime={dateTime}
      title={title ?? formatTimestampTitle(date, timeZone)}
      {...props}
    >
      {formatTimestamp(date, format, timeZone)}
    </time>
  );
}
