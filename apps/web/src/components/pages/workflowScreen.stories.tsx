import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, Textarea, TextInput } from "../field.stylex";
import { FormGrid, FormSection, FormStack } from "../formLayout.stylex";
import { SelectedBottleSummary } from "../selectedBottleSummary.stylex";
import { WorkflowScreen } from "../workflowScreen.stylex";

const meta = {
  title: "Components/Layout/Workflow Screen",
  component: WorkflowScreen,
  args: {
    children: null,
    onClose: () => undefined,
    onSave: () => undefined,
    title: "Log a tasting",
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkflowScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <WorkflowScreen {...args} saveHint="Step 2 of 3">
      <FormStack>
        <SelectedBottleSummary
          brand="Ardbeg"
          metadata="54.2% ABV · NAS · Islay"
          name="Uigeadail"
        />
        <FormSection title="Your tasting">
          <FormGrid>
            <Field htmlFor="workflow-date" label="Date">
              <TextInput
                defaultValue="2026-08-30"
                id="workflow-date"
                type="date"
              />
            </Field>
            <Field htmlFor="workflow-serving" label="Serving">
              <TextInput defaultValue="Neat" id="workflow-serving" />
            </Field>
          </FormGrid>
          <Field htmlFor="workflow-notes" label="Notes" optional>
            <Textarea id="workflow-notes" placeholder="What stood out?" />
          </Field>
        </FormSection>
      </FormStack>
    </WorkflowScreen>
  ),
};

export const Saving: Story = {
  args: { saving: true },
  render: (args) => (
    <WorkflowScreen {...args} saveHint="Saving this tasting">
      <SelectedBottleSummary
        brand="Ardbeg"
        metadata="54.2% ABV · NAS · Islay"
        name="Uigeadail"
      />
    </WorkflowScreen>
  ),
};
