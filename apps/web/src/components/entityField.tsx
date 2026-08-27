import { toTitleCase } from "@peated/server/lib/strings";
import { ENTITY_SEARCH_SCOPE_LIST } from "@peated/server/orpc/contracts/search";
import {
  EntityInputSchema,
  EntityKindEnum,
  EntitySchema,
} from "@peated/server/schemas";
import type { BottleEntityRole, EntityKind } from "@peated/server/types";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import CountryField from "./countryField";
import Fieldset from "./fieldset";
import Form from "./form";
import FormHeader from "./formHeader";
import LayoutModal from "./layoutModal";
import RegionField from "./regionField";
import SelectField from "./selectField";
import { type CreateFormOptions, type Option } from "./selectField/types";
import TextField from "./textField";

const entityKinds = EntityKindEnum.options.map((kind) => ({
  id: kind,
  name: toTitleCase(kind),
}));

type FormSchemaType = z.infer<typeof EntityInputSchema>;

function entityOptionMeta(item: Option) {
  const parsedKind = EntityKindEnum.safeParse(
    "kind" in item ? item.kind : undefined,
  );
  return [
    parsedKind.success ? toTitleCase(parsedKind.data) : null,
    item.shortName,
  ]
    .filter(Boolean)
    .join(" · ");
}

function roleDefaultKind(role?: BottleEntityRole | null): EntityKind {
  if (role === "distiller") return "distillery";
  if (role === "bottler") return "bottler";
  return "brand";
}

export default function EntityField({
  createDialogHelpText,
  searchContext = {},
  ...props
}: React.ComponentProps<typeof SelectField> & {
  createDialogHelpText?: string;
  searchContext?: {
    role?: BottleEntityRole | null;
  };
}) {
  const orpc = useORPC();
  return (
    <SelectField<Option>
      onQuery={async (query) => {
        const { groups } = await orpc.search.call({
          query,
          scopes: [...ENTITY_SEARCH_SCOPE_LIST],
          limit: 25,
        });
        return groups.flatMap((group) =>
          group.results.flatMap((result) => {
            const parsed = EntitySchema.safeParse(result);
            return parsed.success ? [parsed.data] : [];
          }),
        );
      }}
      onRenderOption={(item) => (
        <div className="flex flex-col items-start">
          <div>{item.name}</div>
          <div className="text-muted font-normal">{entityOptionMeta(item)}</div>
        </div>
      )}
      createForm={(props) => {
        return (
          <CreateForm
            createDialogHelpText={createDialogHelpText}
            defaultKind={roleDefaultKind(searchContext.role)}
            {...props}
          />
        );
      }}
      {...props}
    />
  );
}

function CreateForm({
  createDialogHelpText,
  defaultKind,
  data,
  onSubmit,
  onClose,
}: CreateFormOptions<Option> & {
  createDialogHelpText?: string;
  defaultKind: EntityKind;
}) {
  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: { ...data, kind: defaultKind },
  });

  const [countryValue, setCountryValue] = useState<Option | undefined>();
  const [regionValue, setRegionValue] = useState<Option | undefined>();

  return (
    <LayoutModal
      header={
        <FormHeader
          title="Add Entity"
          onSave={handleSubmit(onSubmit)}
          saveDisabled={isSubmitting}
          onClose={onClose}
        />
      }
    >
      <div className="border-y border-slate-700 p-3 lg:mb-4 lg:border lg:p-4">
        <div className="prose prose-invert text-muted max-w-full text-sm leading-6">
          {createDialogHelpText}
        </div>
      </div>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleSubmit(onSubmit)(e);
        }}
        isSubmitting={isSubmitting}
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
            name="kind"
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                label="Kind"
                required
                onChange={(option) => onChange(option?.id)}
                value={
                  value ? { id: value, name: toTitleCase(value) } : undefined
                }
                options={entityKinds}
                simple
              />
            )}
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
    </LayoutModal>
  );
}
