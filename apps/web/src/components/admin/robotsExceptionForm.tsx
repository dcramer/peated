"use client";

import { BotSiteOriginSchema } from "@peated/server/schemas";
import {
  AdminFieldset as Fieldset,
  AdminFormPage as FormPage,
  AdminTextareaField as TextAreaField,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAdminFormSubmit } from "./useAdminFormSubmit";

const RobotsExceptionFormSchema = z.object({
  origin: BotSiteOriginSchema,
  reason: z.string().trim().min(1, "Required").max(500),
});

type FormInput = z.input<typeof RobotsExceptionFormSchema>;
export type RobotsException = z.output<typeof RobotsExceptionFormSchema>;

/** Records why PeatedBot may read pages a website's robots.txt disallows. */
export default function RobotsExceptionForm({
  onSubmit,
}: {
  onSubmit: (data: RobotsException) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, RobotsException>({
    resolver: zodResolver(RobotsExceptionFormSchema),
    defaultValues: { origin: "", reason: "" },
  });
  const { error, submit } = useAdminFormSubmit<RobotsException>(onSubmit);

  return (
    <FormPage
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(submit)}
      title="Add robots.txt exception"
    >
      <Fieldset>
        <TextField
          {...register("origin")}
          label="Website"
          placeholder="https://example.com"
          helpText="Any address on the website. The exception covers the whole website."
          error={errors.origin}
          required
        />
        <TextAreaField
          {...register("reason")}
          label="Reason"
          helpText="Say who allowed it, or why robots.txt doesn't apply. Other admins see this."
          error={errors.reason}
          rows={3}
          required
        />
      </Fieldset>
    </FormPage>
  );
}
