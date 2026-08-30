import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button.stylex";
import { Field, TextInput } from "./field.stylex";
import { Switch } from "./formControls.stylex";
import {
  FormActions,
  FormDetails,
  FormGrid,
  FormNotice,
  FormSection,
  FormStack,
  FormSteps,
} from "./formLayout.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Forms/Form layout",
  component: FormSteps,
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FormSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  args: {
    currentStep: 1,
    steps: ["Rating", "Notes", "Details"],
  },
  render: (args) => (
    <FormStack>
      <FormSteps {...args} />
      <FormNotice>Your email address is waiting for verification.</FormNotice>
      <FormSection
        description="The name and picture shown beside your activity."
        title="Profile"
      >
        <Field htmlFor="form-layout-name" label="Username" required>
          <TextInput defaultValue="dramfriend" id="form-layout-name" />
        </Field>
        <Switch
          checked={false}
          description="Only friends can see your activity."
          label="Private profile"
          onCheckedChange={() => undefined}
        />
      </FormSection>
      <FormDetails
        description="Optional catalog and production information."
        title="More details"
      >
        <FormGrid>
          <Field htmlFor="form-layout-year" label="Release year" optional>
            <TextInput id="form-layout-year" placeholder="2026" />
          </Field>
          <Field htmlFor="form-layout-edition" label="Edition" optional>
            <TextInput id="form-layout-edition" placeholder="Batch 24" />
          </Field>
        </FormGrid>
      </FormDetails>
      <FormActions>
        <Button variant="accent">Save changes</Button>
      </FormActions>
    </FormStack>
  ),
};
