import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RowMenu } from "./rowMenu.stylex";
import { StoryCanvas, StoryRow } from "./storyFixtures.stylex";

const groups = [
  [
    { label: "Log a tasting", onSelect: () => undefined },
    { label: "Add what you paid", onSelect: () => undefined },
  ],
  [{ label: "Remove from library", onSelect: () => undefined }],
] as const;

const meta = {
  title: "Components/Actions/Row Menu",
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
} satisfies Meta<typeof RowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryRow>
      <RowMenu {...args} />
      <RowMenu {...args} variant="page" />
      <RowMenu
        {...args}
        groups={[
          [
            { label: "Log a tasting", onSelect: () => undefined },
            {
              disabled: true,
              label: "Add what you paid",
              onSelect: () => undefined,
            },
          ],
          [{ label: "Remove from library", onSelect: () => undefined }],
        ]}
      />
    </StoryRow>
  ),
};
