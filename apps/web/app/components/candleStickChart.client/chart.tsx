import * as d3 from "d3";
import { useState } from "react";

import Candle from "./candle";
import type { ChartDimensions, DataPoint } from "./types";

type Props = {
  data: DataPoint[];
  width: number;
  height: number;
};

export default function Chart({
  data,
  width: chartWidth,
  height: chartHeight,
}: Props) {
  const [mouseCoords, setMouseCoords] = useState({
    x: 0,
    y: 0,
  });

  const high = (d3.max(data.map((bar) => bar.high)) ?? 0) * 1.25;
  const low = (d3.min(data.map((bar) => bar.low)) ?? 0) * 0.75;

  const chartDims: ChartDimensions = {
    width: chartWidth,
    height: chartHeight,
    high,
    low,
    delta: high - low,
  };

  const pixelFor = (value: number) => {
    return Math.abs(
      ((value - chartDims.low) / chartDims.delta) * chartDims.height -
        chartDims.height,
    );
  };

  const onMouseLeave = () => {
    setMouseCoords({
      x: 0,
      y: 0,
    });
  };

  const onMouseMoveInside = (e) => {
    setMouseCoords({
      x:
        e.nativeEvent.x -
        Math.round(e.currentTarget.getBoundingClientRect().left),
      y:
        e.nativeEvent.y -
        Math.round(e.currentTarget.getBoundingClientRect().top),
    });
  };

  // calculate the candle width
  const candleWidth = Math.floor((chartWidth / data.length) * 0.7);

  const activeCandleIdx =
    Math.round(mouseCoords.x / (chartWidth / (data.length - 1))) - 1;
  const activeCandle = data[activeCandleIdx];

  return (
    <svg
      width={chartWidth}
      height={chartHeight}
      className="bg-slate-900 text-white"
      onMouseMove={onMouseMoveInside}
      onMouseLeave={onMouseLeave}
    >
      {data.map((bar, i) => {
        const candleX = (chartWidth / (data.length + 1)) * (i + 1);
        return (
          <Candle
            active={activeCandleIdx === i}
            key={i}
            data={bar}
            previousData={data[i - 1]}
            x={candleX}
            width={candleWidth}
            pixelFor={pixelFor}
          />
        );
      })}
      {activeCandle && (
        <text x="5" y="16" className="fill-light text-xs">
          <tspan x="5" y="16">
            ${(activeCandle.avg / 100).toFixed(2)} per mL
          </tspan>
        </text>
      )}
    </svg>
  );
}
