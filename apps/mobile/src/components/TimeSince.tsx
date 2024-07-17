"use client";

import dayjs from "dayjs";
import DayJsRelativeTime from "dayjs/plugin/relativeTime";
import { type ComponentProps, useState } from "react";
import { useInterval } from "usehooks-ts";
import { Text } from "./StyledText";

dayjs.extend(DayJsRelativeTime);

export default function TimeSince({
  date,
  ...props
}: { date: string | Date } & ComponentProps<typeof Text>) {
  const [value, setValue] = useState(dayjs(date).fromNow());

  useInterval(() => {
    setValue(dayjs(date).fromNow());
  }, 60000);

  if (!date) return null;
  return <Text {...props}>{value}</Text>;
}
