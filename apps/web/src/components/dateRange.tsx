import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";

dayjs.extend(LocalizedFormat);

export default function DateRange({
  start,
  end,
  ...props
}: {
  start: string | Date;
  end?: string | Date | null;
} & React.ComponentProps<"time">) {
  if (!start) return null;

  const startDateParsed = dayjs(start);
  const endDateParsed = end ? dayjs(end) : null;

  if (end && endDateParsed && start !== end) {
    const startMonth = startDateParsed.month();
    const endMonth = endDateParsed.month();
    const startYear = startDateParsed.year();
    const endYear = endDateParsed.year();
    const currentYear = new Date().getFullYear();

    return (
      <span className="inline-flex items-center gap-x-1">
        <time
          dateTime={start instanceof Date ? start.toISOString() : start}
          {...props}
        >
          {startDateParsed.format("MMMM D")}
          {startYear !== endYear &&
            startYear !== currentYear &&
            ` (${startYear})`}
        </time>
        <span>&ndash;</span>
        <time
          dateTime={end instanceof Date ? end.toISOString() : end}
          {...props}
        >
          {endMonth !== startMonth
            ? endDateParsed.format("MMMM D")
            : endDateParsed.format("D")}
          {startYear !== endYear ||
            (endYear !== currentYear && ` (${endYear})`)}
        </time>
      </span>
    );
  }
  return (
    <time
      dateTime={start instanceof Date ? start.toISOString() : start}
      {...props}
    >
      {startDateParsed.format("LL")}
    </time>
  );
}
