import { zodResolver } from "@hookform/resolvers/zod";
import { EntityInputSchema } from "@peated/server/schemas";
import { type EntityType } from "@peated/server/types";
import { trpc } from "@peated/web/lib/trpc";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import CountryField from "./countryField";
import Fieldset from "./fieldset";
import Form from "./form";
import RegionField from "./regionField";
import SelectField from "./selectField";
import { type CreateFormOptions, type Option } from "./selectField/types";
import TextField from "./textField";

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export default function EntityField({
  createDialogHelpText,
  searchContext = {},
  ...props
}: React.ComponentProps<typeof SelectField> & {
  createDialogHelpText?: string;
  searchContext?: {
    type?: EntityType | null;
    brand?: number | null;
    bottleName?: string | null;
  };
}) {
  const trpcUtils = trpc.useUtils();
  return (
    <SelectField<Option>
      onQuery={async (query) => {
        const { results } = await trpcUtils.entityList.fetch({
          query,
          searchContext,
        });
        return results;
      }}
      onRenderOption={(item) => (
        <div className="flex flex-col items-start">
          <div>{item.name}</div>
          <div className="text-light font-normal">{item.shortName || null}</div>
        </div>
      )}
      createForm={(props) => {
        return (
          <CreateForm createDialogHelpText={createDialogHelpText} {...props} />
        );
      }}
      {...props}
    />
  );
}

function CreateForm({
  createDialogHelpText,
  data,
  onFieldChange,
  onSubmit,
  onClose,
}: CreateFormOptions<Option> & {
  createDialogHelpText?: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: data,
  });

  const [countryValue, setCountryValue] = useState<Option | undefined>();
  const [regionValue, setRegionValue] = useState<Option | undefined>();

  return (
    <>
      <div className="border-y border-slate-700 p-3 lg:mb-4 lg:border lg:p-4">
        <div className="prose prose-invert text-light max-w-full text-sm leading-6">
          {createDialogHelpText}
        </div>
      </div>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return handleSubmit(onSubmit)(e);
        }}
      >
        <Fieldset>
          <TextField
            {...register("name")}
            error={errors.name}
            autoFocus
            label="Name"
            type="text"
            placeholder="e.g. Macallan"
            required
            autoComplete="off"
          />

          <Controller
            control={control}
            name="country"
            render={({ field: { onChange, value, ref, ...field } }) => (
              <CountryField
                {...field}
                error={errors.region}
                label="Country"
                placeholder="e.g. Scotland"
                onChange={(value) => {
                  onChange(value?.id);
                  // if (regionValue?.country.id !== value?.id)
                  setRegionValue(undefined);
                  setCountryValue(value);
                }}
                value={countryValue}
              />
            )}
          />

          <Controller
            control={control}
            name="region"
            render={({ field: { onChange, value, ref, ...field } }) => (
              <RegionField
                {...field}
                error={errors.region}
                label="Region"
                placeholder="e.g. Islay, Kentucky"
                searchContext={{
                  country: getValues("country"),
                }}
                onChange={(value) => {
                  onChange(value?.id);
                  setRegionValue(value);
                }}
                value={regionValue}
                rememberValues={false}
              />
            )}
          />
        </Fieldset>
      </Form>
    </>
  );
}
