"use client";

import { CountryInputSchema } from "@peated/server/schemas";
import { type Country } from "@peated/server/types";
import {
  AdminFieldset as Fieldset,
  AdminFormPage as FormPage,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useMutation } from "@tanstack/react-query";
import { WandSparkles } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import { AdminButton as Button } from "./adminButton.stylex";
import { AdminTextareaField as TextAreaField } from "./adminForm.stylex";
import { useAdminFormSubmit } from "./useAdminFormSubmit";

type FormSchemaType = z.infer<typeof CountryInputSchema>;

export default function CountryForm({
  onSubmit,
  initialData = {},
  edit = false,
  title = "Add Country",
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<Country>;
  edit?: boolean;
  title?: string;
}) {
  const {
    getValues,
    setValue,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(CountryInputSchema),
    defaultValues: initialData,
  });

  const orpc = useORPC();
  const generateDataMutation = useMutation(
    orpc.ai.countryLookup.mutationOptions(),
  );

  const { error, submit } = useAdminFormSubmit(onSubmit);

  return (
    <FormPage
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(submit)}
      title={title}
    >
      <Fieldset>
        <TextField
          {...register("name")}
          label="Name"
          placeholder="e.g. United States"
          readOnly={edit}
          error={errors.name}
          required
        />
      </Fieldset>

      <Fieldset
        title="Additional details"
        action={
          <Button
            variant="tonal"
            onClick={async () => {
              const result =
                await generateDataMutation.mutateAsync(getValues());

              const currentValues = getValues();
              if (result && result.description && !currentValues.description)
                setValue("description", result.description);
              setValue("descriptionSrc", "generated");
              if (result && result.summary && !currentValues.summary)
                setValue("summary", result.summary);
            }}
            disabled={generateDataMutation.isPending}
            icon={<WandSparkles aria-hidden="true" size={18} />}
          >
            Help me fill this in [Beta]
          </Button>
        }
      >
        <TextAreaField
          {...register("description", {
            setValueAs: (v) => (v === "" || !v ? null : v),
            onChange: () => {
              setValue("descriptionSrc", "user");
            },
          })}
          error={errors.description}
          autoFocus
          label="Description"
          rows={8}
        />

        <TextAreaField
          {...register("summary")}
          error={errors.description}
          autoFocus
          helpText="One or two sentences describing the rules for whisky in this region."
          label="Summary"
          rows={8}
        />
      </Fieldset>
    </FormPage>
  );
}
