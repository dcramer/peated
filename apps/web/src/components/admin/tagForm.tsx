"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FLAVOR_PROFILES, TAG_CATEGORIES } from "@peated/server/constants";
import { TagInputSchema } from "@peated/server/schemas";
import { formatFlavorProfile } from "@peated/server/src/lib/format";
import { toTitleCase } from "@peated/server/src/lib/strings";
import { type Tag } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import SelectField from "@peated/web/components/selectField";
import TextField from "@peated/web/components/textField";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError } from "@peated/web/lib/trpc";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import Form from "../form";
import AdminSidebar from "./sidebar";

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

  const [error, setError] = useState<string | undefined>();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      if (isTRPCClientError(err)) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }
  };

  return (
    <Layout
      sidebar={<AdminSidebar />}
      header={
        <Header>
          <FormHeader
            title={title}
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmitHandler)}
          />
        </Header>
      }
      footer={null}
    >
      <Form
        className="sm:mx-16"
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        {error && <FormError values={[error]} />}

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
                simple
                required
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
                simple
                required
                onChange={(value) => onChange(value.map((v) => v.id))}
                error={errors.flavorProfiles}
              />
            )}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
