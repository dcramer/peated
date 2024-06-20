import dayjs from "dayjs";
import DayJsRelativeTime from "dayjs/plugin/relativeTime";
import { useState } from "react";
import { useTimeout } from "usehooks-ts";

dayjs.extend(DayJsRelativeTime);

export default function TimeSince({
  date,
  ...props
}: { date: string | Date } & React.ComponentProps<"time">) {
  const [value, setValue] = useState(dayjs(date).fromNow());

  useTimeout(() => {
    setValue(dayjs(date).fromNow());
  }, 60000);

  if (!date) return null;
  return (
    <time
      dateTime={date instanceof Date ? date.toISOString() : date}
      {...props}
    >
      {value}
    </time>
  );
}
