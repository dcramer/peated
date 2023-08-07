import dayjs from "dayjs";
import DayJsRelativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(DayJsRelativeTime);

export default function TimeSince({
  date,
  ...props
}: { date: string | Date } & React.ComponentProps<"time">) {
  if (!date) return null;
  return (
    <time
      dateTime={date instanceof Date ? date.toISOString() : date}
      {...props}
    >
      {dayjs(date).fromNow()}
    </time>
  );
}
