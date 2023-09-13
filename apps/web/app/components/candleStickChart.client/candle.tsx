import classNames from "~/lib/classNames";
import type { DataPoint } from "./types";

type Props = {
  active: boolean;
  width: number;
  x: number;
  data: DataPoint;
  previousData?: DataPoint;
  pixelFor: (value: number) => number;
};

export default function Candle({
  active,
  data,
  previousData,
  x,
  width: candleWidth,
  pixelFor,
}: Props) {
  const up = !previousData || previousData.avg > data.avg;
  const down = previousData && previousData.avg < data.avg;
  const barTop = pixelFor(data.avg);
  const barBottom = pixelFor(data.avg);
  const barHeight = 2;
  const wickTop = pixelFor(data.high);
  const wickBottom = pixelFor(data.low);

  return (
    <>
      <rect
        x={x - candleWidth / 2}
        y={barTop}
        width={candleWidth}
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
      <line
        className={classNames(
          "top stroke-2",
          up ? "stroke-green-400" : down ? "stroke-red-400" : "stroke-light",
        )}
        x1={x}
        y1={barTop}
        x2={x}
        y2={wickTop}
      />
      <line
        className={classNames(
          "bottom stroke-2",
          up ? "stroke-green-400" : down ? "stroke-red-400" : "stroke-light",
        )}
        x1={x}
        y1={barBottom}
        x2={x}
        y2={wickBottom}
      />
    </>
  );
}
