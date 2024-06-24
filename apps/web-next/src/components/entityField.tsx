import { zodResolver } from "@hookform/resolvers/zod";
import { EntityInputSchema } from "@peated/server/schemas";
import { type EntityType } from "@peated/server/src/types";
import { trpc } from "@peated/web/lib/trpc";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import Button from "./button";
import CountryField from "./countryField";
import Fieldset from "./fieldset";
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
    <SelectField
      onQuery={async (query) => {
        const { results } = await trpcUtils.entityList.fetch({
          query,
          searchContext,
        });
        return results;
      }}
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
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: data,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return handleSubmit(onSubmit)(e);
      }}
      className="max-w-md flex-auto"
    >
      <Fieldset>
        <p className="mb-4">{createDialogHelpText}</p>
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

        <CountryField
          control={control}
          name="country"
          error={errors.country}
          label="Country"
          placeholder="e.g. Scotland, United States of America"
          required
        />
        <TextField
          {...register("region")}
          error={errors.region}
          name="region"
          label="Region"
          type="text"
          placeholder="e.g. Islay, Kentucky"
          autoComplete="off"
          onChange={(e) => onFieldChange({ [e.target.name]: e.target.value })}
        />
        <div className="mt-5 flex flex-row-reverse gap-x-2 sm:mt-6">
          <Button color="primary" type="submit" disabled={isSubmitting}>
            Save Changes
          </Button>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </Fieldset>
    </form>
  );
}
