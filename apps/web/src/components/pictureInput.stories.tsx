import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import RobotImage from "../assets/robot.png";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { PictureInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Picture Input",
  component: PictureInput,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "picture",
    name: "picture",
    onFilesSelected: () => undefined,
  },
} satisfies Meta<typeof PictureInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <PictureInput {...args} />
      <PictureInput
        {...args}
        id="picture-preview"
        name="picture-preview"
        onRemove={() => undefined}
        preview={{ alt: "Current tasting picture", src: RobotImage.src }}
      />
      <PictureInput
        {...args}
        disabled
        id="disabled-picture"
        name="disabled-picture"
      />
    </StoryStack>
  ),
};
