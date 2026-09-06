"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Chip } from "./chip.stylex";
import { StoryRow } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Labels/Chip",
  component: Chip,
  args: { children: "Smoke", size: "md", variant: "neutral" },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md"],
    },
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

export const CompactNotes: Story = {
  render: () => (
    <StoryRow>
      <Chip size="sm">Smoke</Chip>
      <Chip size="sm">Dried fruit</Chip>
      <Chip size="sm">Sea salt</Chip>
      <Chip size="sm">+2 more</Chip>
    </StoryRow>
  ),
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
