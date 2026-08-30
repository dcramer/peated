"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryRow } from "../storyFixtures.stylex";
import { Chip } from "./chip.stylex";

const meta = {
  title: "Components/Selection/Chip",
  component: Chip,
  args: { children: "Smoke", variant: "neutral" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["neutral", "tinted", "solid"],
    },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryRow>
      <Chip {...args} />
      <Chip variant="tinted">Dried fruit</Chip>
      <Chip variant="solid">Selected</Chip>
      <Chip disabled onClick={() => undefined}>
        Unavailable
      </Chip>
    </StoryRow>
  ),
};

export const InteractiveNotes: Story = {
  render: () => <InteractiveChipSet />,
};

function InteractiveChipSet() {
  const notes = ["Smoke", "Ash", "Dried fig", "Lemon peel"];
  const [selected, setSelected] = useState(["Smoke", "Dried fig"]);

  return (
    <StoryRow>
      {notes.map((note) => {
        const isSelected = selected.includes(note);
        return (
          <Chip
            aria-pressed={isSelected}
            key={note}
            onClick={() =>
              setSelected((current) =>
                current.includes(note)
                  ? current.filter((value) => value !== note)
                  : [...current, note],
              )
            }
            variant={isSelected ? "solid" : "neutral"}
          >
            {note} {isSelected ? "×" : null}
          </Chip>
        );
      })}
    </StoryRow>
  );
}
