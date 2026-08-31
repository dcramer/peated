import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { space } from "../styles/tokens.stylex";
import { BottleVisual } from "./bottleIdentityRow.stylex";
import {
  FactGrid,
  FigureRow,
  RailLinkList,
  RailSection,
  RecordMasthead,
  RecordSection,
  RecordTabs,
} from "./recordDetails.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Pages/Bottle",
  component: RecordMasthead,
  args: {
    detail: "Single malt · Ardbeg Distillery · Islay",
    name: "Uigeadail",
    prefix: "Ardbeg",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof RecordMasthead>;

export default meta;
type Story = StoryObj<typeof meta>;

function RecordExample() {
  const [currentHref, setCurrentHref] = useState("#overview");
  return (
    <div>
      <RecordMasthead
        aside={<BottleVisual label="Ardbeg Uigeadail bottle" size="lg" />}
        detail="Single malt · Ardbeg Distillery · Islay"
        name="Uigeadail"
        prefix="Ardbeg"
        status="In your library · tasted"
      />
      <FigureRow
        figures={[
          { label: "Score", value: 92 },
          { label: "Tastings", value: "2,841" },
          {
            label: "Most picked",
            scale: "word",
            value: "Outstanding",
            wide: true,
          },
          { label: "Release year" },
        ]}
      />
      <RecordTabs
        ariaLabel="Bottle sections"
        currentHref={currentHref}
        items={[
          { href: "#overview", label: "Overview" },
          { count: 128, href: "#tastings", label: "Tastings" },
          { count: 14, href: "#reviews", label: "Reviews" },
        ]}
        onSelect={setCurrentHref}
      />
      <div {...stylex.props(styles.columns)}>
        <div>
          <RecordSection title="Details">
            <FactGrid
              facts={[
                { label: "Age", value: "NAS" },
                { label: "Strength", value: "54.2% ABV" },
                { label: "Cask", value: "Bourbon · sherry" },
                { label: "Bottle size", value: "750 ml" },
                { label: "Vintage" },
                { label: "Bottled", value: "2025" },
              ]}
            />
          </RecordSection>
          <RecordSection aside="Updated 12 Aug 2026" title="Record notes">
            The catalog record keeps supplied facts visible and marks unknown
            values with an en dash.
          </RecordSection>
        </div>
        <aside {...stylex.props(styles.rail)}>
          <RailSection title="Related bottles">
            <RailLinkList
              ariaLabel="Related bottles"
              items={[
                {
                  end: 91,
                  endFormat: "data",
                  href: "#corryvreckan",
                  metadata: "57.1% ABV",
                  name: "Corryvreckan",
                },
                {
                  end: "–",
                  endAbsent: true,
                  href: "#an-oa",
                  metadata: "46.6% ABV",
                  name: "An Oa",
                },
                {
                  end: 89,
                  endFormat: "data",
                  href: "#ten",
                  metadata: "46.0% ABV",
                  name: "10 Year Old",
                },
              ]}
            />
          </RailSection>
        </aside>
      </div>
    </div>
  );
}

export const Overview: Story = { render: () => <RecordExample /> };

const styles = stylex.create({
  columns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: "64px",
    marginTop: "40px",
    alignItems: "start",
    "@media (max-width: 899px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x8,
    },
  },
  rail: { display: "flex", flexDirection: "column", gap: "36px" },
});
