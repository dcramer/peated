import type { ViewportMap } from "storybook/viewport";

export const peatedViewports = {
  peatedWide: {
    name: "Peated · Wide",
    styles: { height: "900px", width: "1320px" },
    type: "desktop",
  },
  peatedRail: {
    name: "Peated · Rail",
    styles: { height: "900px", width: "1040px" },
    type: "desktop",
  },
  peatedFolded: {
    name: "Peated · Folded",
    styles: { height: "900px", width: "900px" },
    type: "tablet",
  },
  peatedStacked: {
    name: "Peated · Stacked",
    styles: { height: "900px", width: "680px" },
    type: "tablet",
  },
  peatedPhone: {
    name: "Peated · Phone",
    styles: { height: "844px", width: "390px" },
    type: "mobile",
  },
  peatedEdge: {
    name: "Peated · 320 edge",
    styles: { height: "568px", width: "320px" },
    type: "mobile",
  },
} satisfies ViewportMap;

export const quickViewports = [
  { id: "wide", label: "Wide", value: undefined },
  { id: "folded", label: "Folded", value: "peatedFolded" },
  { id: "phone", label: "Phone", value: "peatedPhone" },
] as const;
