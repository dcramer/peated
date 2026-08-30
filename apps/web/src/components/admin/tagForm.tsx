"use client";

import { FLAVOR_PROFILES, TAG_CATEGORIES } from "@peated/server/constants";
import { formatFlavorProfile } from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import { TagInputSchema } from "@peated/server/schemas";
import { type Tag } from "@peated/server/types";
import {
  AdminFieldset as Fieldset,
  AdminFormPage as FormPage,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import SelectField from "@peated/web/components/selectField";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import { useAdminFormSubmit } from "./useAdminFormSubmit";

type FormSchemaType = z.infer<typeof TagInputSchema>;

const CATEGORY_TYPES = TAG_CATEGORIES.map((t) => ({
  id: t,
  name: toTitleCase(t),
}));

const FLAVOR_PROFILE_TYPES = FLAVOR_PROFILES.map((t) => ({
  id: t,
  name: formatFlavorProfile(t),
}));

export default function TagForm({
  onSubmit,
  initialData = {},
  edit = false,
  title = "Add Tag",
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<Tag>;
  edit?: boolean;
  title?: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(TagInputSchema),
    defaultValues: initialData,
  });

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
          placeholder="e.g. acidic"
          readOnly={edit}
          error={errors.name}
        />

        <Controller
          name="tagCategory"
          control={control}
          render={({ field: { onChange, ref, value, ...field } }) => (
            <SelectField
              {...field}
              label="Category"
              value={value ? { id: value, name: toTitleCase(value) } : null}
              placeholder="e.g. fruity"
              options={CATEGORY_TYPES}
              onChange={(value) => onChange(value?.id)}
              error={errors.tagCategory}
            />
          )}
        />

        <Controller
          name="flavorProfiles"
          control={control}
          render={({ field: { onChange, ref, value, ...field } }) => (
            <SelectField
              {...field}
              label="Flavor Profiles"
              multiple
              value={
                value
                  ? value.map((v) => ({
                      id: v,
                      name: formatFlavorProfile(v),
                    }))
                  : null
              }
              options={FLAVOR_PROFILE_TYPES}
              onChange={(value) => onChange(value.map((v) => v.id))}
              error={errors.flavorProfiles}
            />
          )}
        />
      </Fieldset>
    </FormPage>
  );
}
