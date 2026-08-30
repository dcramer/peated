"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { NotePicker, NotePickerField } from "./notePicker.stylex";
import { noteOptions } from "./storyData";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Selection/Note Picker",
  component: NotePicker,
  args: {
    notes: noteOptions,
    onChange: () => undefined,
    onConfirm: () => undefined,
    value: ["Smoke", "Sea salt", "Dried fig"],
  },
  argTypes: {
    notes: { control: false },
    onChange: { control: false },
    onClose: { control: false },
    onConfirm: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof NotePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preselected: Story = {
  render: (args) => <ControlledNotePicker {...args} />,
};

export const Empty: Story = {
  args: { value: [] },
  render: (args) => <ControlledNotePicker {...args} />,
};

export const FormField: Story = {
  render: () => <ControlledNotePickerField />,
};

function ControlledNotePicker(props: React.ComponentProps<typeof NotePicker>) {
  const [value, setValue] = useState<readonly string[]>(props.value);
  return <NotePicker {...props} onChange={setValue} value={value} />;
}

function ControlledNotePickerField() {
  const [value, setValue] = useState<readonly string[]>(["Smoke", "Sea salt"]);
  return (
    <NotePickerField notes={noteOptions} onChange={setValue} value={value} />
  );
}
