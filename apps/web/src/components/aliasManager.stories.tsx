import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AliasManager } from "./aliasManager.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Catalog/Aliases",
  component: AliasManager,
  args: {
    aliases: [
      { created: "Aug 12, 2026", isCanonical: true, name: "Lagavulin" },
      {
        created: "Aug 18, 2026",
        isCanonical: false,
        name: "Lagavulin Distillery",
      },
    ],
    canEdit: true,
    onCreate: async () => undefined,
    onDelete: async () => undefined,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof AliasManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
