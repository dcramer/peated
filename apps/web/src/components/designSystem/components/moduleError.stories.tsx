import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { ModuleError } from "./feedback.stylex";

const meta = {
  title: "Components/Feedback/Module Error",
  component: ModuleError,
  args: {
    children:
      "The rest of this bottle page still works. Try loading the tasting history again.",
    detail: "Error 503",
    heading: "Tasting history is unavailable",
    onRetry: () => undefined,
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ModuleError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ModuleError {...args} />
      <ModuleError {...args} onRetry={undefined} />
    </StoryStack>
  ),
};
