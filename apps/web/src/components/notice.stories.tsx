import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button.stylex";
import { Notice } from "./feedback.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Messages & Status/Notice",
  component: Notice,
  args: { children: "The source lists two different bottling years." },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <Notice heading="Source detail">
        The producer lists this release without a bottle size.
      </Notice>
      <Notice
        action={
          <Button size="sm" variant="tonal">
            Review the source
          </Button>
        }
        heading="Conflicting dates"
        tone="warning"
      >
        The source lists two different bottling years.
      </Notice>
      <Notice heading="Disputed value" tone="critical">
        This strength does not match the bottle image.
      </Notice>
    </StoryStack>
  ),
};
