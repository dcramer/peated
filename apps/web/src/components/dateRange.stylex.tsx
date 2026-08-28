import * as stylex from "@stylexjs/stylex";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";

import { space } from "../styles/tokens.stylex";

dayjs.extend(LocalizedFormat);

export default function DateRange({
  end,
  start,
  ...props
}: {
  end?: string | Date | null;
  start: string | Date;
} & React.ComponentProps<"time">) {
  const startDate = dayjs(start);
  const endDate = end ? dayjs(end) : null;
  if (end && endDate && start !== end) {
    const startMonth = startDate.month();
    const startYear = startDate.year();
    const endYear = endDate.year();
    return (
      <span {...stylex.props(styles.range)}>
        <time
          dateTime={start instanceof Date ? start.toISOString() : start}
          {...props}
        >
          {startDate.format(startYear !== endYear ? "MMMM D, YYYY" : "MMMM D")}
        </time>
        <span>–</span>
        <time
          dateTime={end instanceof Date ? end.toISOString() : end}
          {...props}
        >
          {endDate.month() !== startMonth
            ? endDate.format("MMMM D")
            : endDate.format("D")}
          , {endYear}
        </time>
      </span>
    );
  }
  return (
    <time
      dateTime={start instanceof Date ? start.toISOString() : start}
      {...props}
    >
      {startDate.format("LL")}
    </time>
  );
}

const styles = stylex.create({
  range: {
    display: "inline-flex",
    alignItems: "center",
    gap: space.x1,
    whiteSpace: "nowrap",
  },
});
