"use client";

import { BoltIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { CountryInputSchema } from "@peated/server/schemas";
import { type Country } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import TextField from "@peated/web/components/textField";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc";
import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import Button from "../button";
import Form from "../form";
import TextAreaField from "../textAreaField";
import AdminSidebar from "./sidebar";

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

  const generateDataMutation = trpc.countryGenerateDetails.useMutation();

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
            placeholder="e.g. United States"
            error={errors.name}
            required
          />

          <TextField
            {...register("slug")}
            label="slug"
            placeholder="e.g. united-states"
            readOnly={edit}
            error={errors.slug}
            required
          />
        </Fieldset>

        <Fieldset>
          <legend className="text-light flex w-full items-center border-t border-slate-800 bg-slate-950 px-4 py-5">
            <div className="flex-grow">Additional Details</div>
            <Button
              color="default"
              onClick={async () => {
                const result =
                  await generateDataMutation.mutateAsync(getValues());

                const currentValues = getValues();
                if (result && result.description && !currentValues.description)
                  setValue("description", result.description);
                setValue("descriptionSrc", "generated");
              }}
              disabled={generateDataMutation.isPending}
              icon={<BoltIcon className="-ml-0.5 h-4 w-4" />}
            >
              Help me fill this in [Beta]
            </Button>
          </legend>
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
        </Fieldset>
      </Form>
    </Layout>
  );
}
