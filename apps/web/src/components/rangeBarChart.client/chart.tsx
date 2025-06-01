"use client";

import { type MouseEvent, useState } from "react";

import Bar from "./bar";
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

  const high = (Math.max(...data.map((bar) => bar.high)) ?? 0) * 1.25;
  const low = (Math.min(...data.map((bar) => bar.low)) ?? 0) * 0.5;

  const chartDims: ChartDimensions = {
    width: chartWidth,
    height: chartHeight,
    high,
    low,
    delta: high - low,
    unitHeight: chartHeight / (high - low),
  };

  const pixelFor = (value: number) => {
    return (chartDims.high - value) * chartDims.unitHeight;
  };

  const onMouseLeave = () => {
    setMouseCoords({
      x: 0,
      y: 0,
    });
  };

  const onMouseMoveInside = (e: MouseEvent<SVGSVGElement>) => {
    setMouseCoords({
      x:
        e.nativeEvent.x -
        Math.round(e.currentTarget.getBoundingClientRect().left),
      y:
        e.nativeEvent.y -
        Math.round(e.currentTarget.getBoundingClientRect().top),
    });
  };

  const itemWidth = Math.floor((chartWidth / data.length) * 0.7);

  const activeItemIdx =
    Math.round(mouseCoords.x / (chartWidth / (data.length - 1))) - 1;
  const activeItem = data[activeItemIdx];

  return (
    <svg
      width={chartWidth}
      height={chartHeight}
      className="bg-slate-900 p-2 text-white"
      onMouseMove={onMouseMoveInside}
      onMouseLeave={onMouseLeave}
    >
      {data.map((bar, i) => {
        const itemX = (chartWidth / (data.length + 1)) * (i + 1);
        return (
          <Bar
            active={activeItemIdx === i}
            key={i}
            data={bar}
            previousData={data[i - 1]}
            x={itemX}
            width={itemWidth}
            unitHeight={chartDims.unitHeight}
            pixelFor={pixelFor}
          />
        );
      })}
      {activeItem && (
        <text x="5" y="16" className="fill-muted text-xs">
          <tspan x="5" y="16">
            ${(activeItem.avg / 100).toFixed(2)} per mL
          </tspan>
        </text>
      )}
    </svg>
  );
}
