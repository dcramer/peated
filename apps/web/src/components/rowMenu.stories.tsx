import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RowMenu } from "./rowMenu.stylex";
import { StoryCanvas, StoryRow } from "./storyFixtures.stylex";

const groups = [
  [
    { label: "Rate this bottle", onSelect: () => undefined },
    { label: "Add what you paid", onSelect: () => undefined },
  ],
  [{ label: "Remove from Library", onSelect: () => undefined }],
] as const;

const meta = {
  title: "Components/Buttons & Menus/Row Menu",
  component: RowMenu,
  args: {
    groups,
    label: "Bowmore 15",
  },
  argTypes: {
    groups: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas align="end" width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Use this menu for actions that do not need a permanent button.",
      },
    },
  },
} satisfies Meta<typeof RowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  render: (args) => (
    <StoryRow>
      <RowMenu {...args} />
      <RowMenu {...args} label="Frameless menu" triggerVariant="text" />
    </StoryRow>
  ),
};

export const FramedOpen: Story = {
  args: {
    label: "Bottle actions",
    variant: "page",
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Bottle actions" }),
    );
  },
};

export const FramelessOpen: Story = {
  args: {
    label: "Bowmore 15",
    triggerVariant: "text",
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Bowmore 15" }),
    );
  },
};
