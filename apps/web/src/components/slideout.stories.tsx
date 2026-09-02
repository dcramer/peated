import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";
import { Button } from "./button.stylex";
import { Slideout } from "./slideout.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Overlays/Slideout",
  component: Slideout,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    title: "Smoke",
    children: <p>Peat smoke, ash, medicine, wet stone, and sea air.</p>,
  },
  argTypes: {
    children: { control: false },
    footer: { control: false },
    onClose: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Slideout>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Close with the button, Escape, or backdrop. Focus returns to the opening button. */
export const Overview: Story = {
  render: function Overview(args) {
    const [{ open }, updateArgs] = useArgs();
    return (
      <>
        <Button onClick={() => updateArgs({ open: true })}>
          Explore smoke
        </Button>
        <Slideout
          {...args}
          open={open}
          onClose={() => updateArgs({ open: false })}
        />
      </>
    );
  },
};

export const ScrollableBody: Story = {
  args: {
    title: "Tasting notes",
    children: Array.from({ length: 18 }, (_, index) => (
      <p key={index}>
        Choose the words that fit what you smell or taste. You can choose notes
        from more than one category.
      </p>
    )),
  },
  render: function ScrollableBody(args) {
    const [{ open }, updateArgs] = useArgs();
    return (
      <>
        <Button onClick={() => updateArgs({ open: true })}>
          Open tasting notes
        </Button>
        <Slideout
          {...args}
          open={open}
          onClose={() => updateArgs({ open: false })}
          footer={
            <Button variant="tonal" onClick={() => updateArgs({ open: false })}>
              Done
            </Button>
          }
        />
      </>
    );
  },
};
