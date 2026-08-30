"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import { EntityInputSchema, EntityKindEnum } from "@peated/server/schemas";
import type { Entity } from "@peated/server/types";
import {
  Button,
  EntityPicker,
  Field,
  FormNotice,
  FormSection,
  FormStack,
  Select,
  Textarea,
  TextInput,
  type EntityPickerOption,
} from "@peated/web/components/designSystem/components";
import { WorkflowScreen } from "@peated/web/components/designSystem/patterns/workflowScreen.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { WandSparkles } from "lucide-react";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type EntityFormData = z.infer<typeof EntityInputSchema>;

export default function EntityForm({
  initialData = {},
  onSubmit,
  title,
}: {
  initialData?: Partial<Entity>;
  onSubmit: SubmitHandler<EntityFormData>;
  title: string;
}) {
  const orpc = useORPC();
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState<string>();
  const [ownerQuery, setOwnerQuery] = useState("");
  const [owner, setOwner] = useState<EntityPickerOption | null>(() =>
    initialData.owner
      ? {
          detail: "Current direct owner",
          id: String(initialData.owner.id),
          meta: initialData.owner.peatedId,
          name: initialData.owner.name,
        }
      : null,
  );
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<EntityFormData>({
    defaultValues: {
      ...initialData,
      country: initialData.country?.id ?? null,
      ownerId: initialData.owner?.id ?? initialData.ownerId ?? null,
      region: initialData.region?.id ?? null,
    },
    resolver: zodResolver(EntityInputSchema),
  });
  const country = watch("country");
  const { data: countries } = useSuspenseQuery(
    orpc.countries.list.queryOptions({ input: { limit: 100, sort: "name" } }),
  );
  const regions = useQuery({
    ...orpc.regions.list.queryOptions({
      input: { country: String(country ?? ""), limit: 100, sort: "name" },
    }),
    enabled: Boolean(country),
  });
  const ownerResults = useQuery(
    orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: ownerQuery,
        sort: ownerQuery ? "rank" : "name",
      },
    }),
  );
  const generateData = useMutation(orpc.ai.entityLookup.mutationOptions());

  const submit: SubmitHandler<EntityFormData> = async (data) => {
    setSubmitError(undefined);
    try {
      await onSubmit(data);
    } catch (error) {
      setSubmitError(getFormErrorMessage(error));
    }
  };

  async function fillDetails() {
    const result = await generateData.mutateAsync(getValues());
    const current = getValues();
    if (result?.description && !current.description) {
      setValue("description", result.description);
      setValue("descriptionSrc", "generated");
    }
    if (result?.yearEstablished && !current.yearEstablished) {
      setValue("yearEstablished", result.yearEstablished);
    }
  }

  return (
    <WorkflowScreen
      onSave={handleSubmit(submit)}
      saving={isSubmitting}
      title={title}
    >
      <form onSubmit={handleSubmit(submit)}>
        <FormStack>
          {submitError ? <FormNotice>{submitError}</FormNotice> : null}
          <FormSection title="Identity">
            <Field
              error={errors.name?.message}
              errorId="entity-name-error"
              htmlFor="entity-name"
              label="Name"
              required
            >
              <TextInput
                {...register("name")}
                aria-describedby={errors.name ? "entity-name-error" : undefined}
                autoComplete="off"
                autoFocus
                id="entity-name"
                invalid={Boolean(errors.name)}
                placeholder="Macallan"
              />
            </Field>
            <Field
              error={errors.shortName?.message}
              errorId="entity-short-name-error"
              hint="Use the shorter name printed on bottle labels, when one exists."
              htmlFor="entity-short-name"
              label="Short name"
              optional
            >
              <TextInput
                {...register("shortName", {
                  setValueAs: (value) => value || null,
                })}
                aria-describedby="entity-short-name-error"
                autoComplete="off"
                id="entity-short-name"
                invalid={Boolean(errors.shortName)}
                placeholder="The Macallan"
              />
            </Field>
            <Field
              error={errors.kind?.message}
              htmlFor="entity-kind"
              label="Kind"
              required
            >
              <Select
                {...register("kind")}
                id="entity-kind"
                invalid={Boolean(errors.kind)}
              >
                {EntityKindEnum.options.map((kind) => (
                  <option key={kind} value={kind}>
                    {toTitleCase(kind)}
                  </option>
                ))}
              </Select>
            </Field>
          </FormSection>

          <FormSection title="Location">
            <Field htmlFor="entity-country" label="Country" optional>
              <Select
                id="entity-country"
                onChange={(event) => {
                  const nextCountry = event.currentTarget.value;
                  setValue("country", nextCountry ? Number(nextCountry) : null);
                  setValue("region", null);
                }}
                value={country ?? ""}
              >
                <option value="">Not set</option>
                {countries.results.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="entity-region" label="Region" optional>
              <Select
                disabled={!country || regions.isLoading}
                id="entity-region"
                onChange={(event) =>
                  setValue(
                    "region",
                    event.currentTarget.value
                      ? Number(event.currentTarget.value)
                      : null,
                  )
                }
                value={watch("region") ?? ""}
              >
                <option value="">
                  {regions.isLoading ? "Loading regions…" : "Not set"}
                </option>
                {regions.data?.results.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              error={errors.address?.message}
              htmlFor="entity-address"
              label="Address"
              optional
            >
              <Textarea
                {...register("address", {
                  setValueAs: (value) => value || null,
                })}
                id="entity-address"
                invalid={Boolean(errors.address)}
                placeholder="132 Whisky Lane, Islay, Scotland"
                rows={3}
              />
            </Field>
          </FormSection>

          <FormSection
            action={
              user?.mod || user?.admin ? (
                <Button
                  loading={generateData.isPending}
                  onClick={() => void fillDetails()}
                  size="sm"
                  variant="tonal"
                >
                  <WandSparkles aria-hidden="true" size={15} />
                  Fill details
                </Button>
              ) : undefined
            }
            title="Details"
          >
            <EntityPicker
              help="The current direct owner, when one is known."
              kind="entity"
              label="Owned by"
              loading={ownerResults.isFetching}
              onChange={(value) => {
                setOwner(value);
                setValue("ownerId", value ? Number(value.id) : null);
              }}
              onQueryChange={setOwnerQuery}
              options={(ownerResults.data?.results ?? []).map((item) => ({
                detail: [
                  toTitleCase(item.kind),
                  item.region?.name ?? item.country?.name,
                ]
                  .filter(Boolean)
                  .join(" · "),
                id: String(item.id),
                meta: item.peatedId,
                name: item.name,
              }))}
              placeholder="Search entities"
              value={owner}
            />
            <Field
              error={errors.website?.message}
              htmlFor="entity-website"
              label="Website"
              optional
            >
              <TextInput
                {...register("website", {
                  setValueAs: (value) => value || null,
                })}
                id="entity-website"
                invalid={Boolean(errors.website)}
                placeholder="https://example.com"
                type="url"
              />
            </Field>
            <Field
              error={errors.yearEstablished?.message}
              htmlFor="entity-year"
              label="Year established"
              optional
            >
              <TextInput
                {...register("yearEstablished", {
                  setValueAs: (value) => (value ? Number(value) : null),
                })}
                format="data"
                id="entity-year"
                invalid={Boolean(errors.yearEstablished)}
                max={new Date().getFullYear()}
                placeholder="1824"
                type="number"
              />
            </Field>
            {user?.mod || user?.admin ? (
              <Field
                error={errors.description?.message}
                htmlFor="entity-description"
                label="Description"
                optional
              >
                <Textarea
                  {...register("description", {
                    onChange: () => setValue("descriptionSrc", "user"),
                    setValueAs: (value) => value || null,
                  })}
                  id="entity-description"
                  invalid={Boolean(errors.description)}
                  rows={8}
                />
              </Field>
            ) : null}
          </FormSection>
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}
