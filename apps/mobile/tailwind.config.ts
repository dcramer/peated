import preset from "@peated/design/tailwind/native";
import type { Config } from "tailwindcss";
// @ts-expect-error - no types
import nativeWind from "nativewind/preset";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  presets: [preset, nativeWind],
} as Config;
