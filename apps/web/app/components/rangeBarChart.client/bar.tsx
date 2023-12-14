import classNames from "@peated/web/lib/classNames";
import type { DataPoint } from "./types";

type Props = {
  active: boolean;
  width: number;
  unitHeight: number;
  x: number;
  data: DataPoint;
  previousData?: DataPoint;
  pixelFor: (value: number) => number;
};

export default function Bar({
  active,
  data,
  previousData,
  x,
  width,
  unitHeight,
  pixelFor,
}: Props) {
  const up = !previousData || previousData.avg > data.avg;
  const down = previousData && previousData.avg < data.avg;
  const barTop = pixelFor(data.high);
  const barBottom = pixelFor(data.low);
  const barHeight = Math.max(barTop - barBottom, 1) * unitHeight;

  return (
    <>
      <rect
        x={x - width / 2}
        y={barTop}
        width={width}
        height={barHeight}
        className={classNames(
          "stroke-1",
          active ? "opacity-100" : "opacity-60",
          up
            ? "fill-green-400 stroke-green-400"
            : down
            ? "fill-red-400 stroke-red-400"
            : "fill-light stroke-light",
        )}
      />
    </>
  );
}
