import {
  LazyMotion,
  type MotionValue,
  domAnimation,
  m,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect } from "react";

const fontSize = 14;
const padding = 0;
const height = fontSize + padding;

export default function Counter({ value }: { value: number }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <div style={{ fontSize }} className="overflow-hidden">
        <Digit value={value} />
      </div>
    </LazyMotion>
  );
}

function Digit({ value }: { value: number }) {
  let animatedValue = useSpring(value);

  useEffect(() => {
    animatedValue.set(value);
  }, [animatedValue, value]);

  return (
    <div style={{ height }} className="relative w-[1ch] tabular-nums">
      {[...Array(10).keys()].map((i) => (
        <Number key={i} mv={animatedValue} number={i} />
      ))}
    </div>
  );
}

function Number({ mv, number }: { mv: MotionValue; number: number }) {
  let y = useTransform(mv, (latest) => {
    let placeValue = latest % 10;
    let offset = (10 + number - placeValue) % 10;

    let memo = offset * height;

    if (offset > 5) {
      memo -= 10 * height;
    }

    return memo;
  });

  return (
    <m.span
      style={{ y }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {number}
    </m.span>
  );
}
