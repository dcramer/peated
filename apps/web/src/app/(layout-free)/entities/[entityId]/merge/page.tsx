"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import { EntityMergeSchema } from "@peated/server/schemas";
import {
  ChoiceList,
  FieldGroup,
  FormNotice,
  FormSection,
  FormStack,
  SearchSelect,
  type SearchPickerOption,
} from "@peated/web/components/designSystem/components";
import { WorkflowScreen } from "@peated/web/components/designSystem/patterns/workflowScreen.stylex";
import { useFlashMessages } from "@peated/web/components/flash";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { zodResolver } from "@peated/web/lib/zodResolver";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof EntityMergeSchema>;

export default function Page(props: { params: Promise<{ entityId: string }> }) {
  const { entityId } = use(props.params);
  return (
    <ModRequired>
      <EntityMergeForm entityId={entityId} />
    </ModRequired>
  );
}

function EntityMergeForm({ entityId }: { entityId: string }) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({ input: { entity: Number(entityId) } }),
  );
  const [query, setQuery] = useState("");
  const [other, setOther] = useState<SearchPickerOption | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const results = useQuery(
    orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query,
        sort: query ? "rank" : "name",
      },
    }),
  );
  const merge = useMutation({
    ...orpc.entities.merge.mutationOptions(),
    onSuccess: (nextEntity) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.entities.details.key({
          input: { entity: nextEntity.id },
        }),
      });
    },
  });
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<FormSchemaType>({
    defaultValues: { direction: "mergeInto" },
    resolver: zodResolver(EntityMergeSchema),
  });

  const submit: SubmitHandler<FormSchemaType> = async (data) => {
    setSubmitError(undefined);
    try {
      const nextEntity = await merge.mutateAsync({
        direction: data.direction,
        entity: entity.id,
        other: data.entityId,
      });
      flash(
        <div>
          Performing merge asynchronously. Updates may take a few minutes.
        </div>,
      );
      router.push(getEntityUrl(nextEntity));
    } catch (error) {
      setSubmitError(
        getFormErrorMessage(error, { allowAnyErrorMessage: true }),
      );
    }
  };

  return (
    <WorkflowScreen
      onSave={handleSubmit(submit)}
      saveLabel="Continue"
      saving={isSubmitting}
      title="Merge entity"
    >
      <form onSubmit={handleSubmit(submit)}>
        <FormStack>
          <FormNotice>Current record: {entity.name}</FormNotice>
          {submitError ? <FormNotice>{submitError}</FormNotice> : null}
          <FormSection title="Duplicate record">
            <Controller
              control={control}
              name="entityId"
              render={({ field }) => (
                <FieldGroup
                  error={errors.entityId?.message}
                  label="Other entity"
                  required
                >
                  <SearchSelect
                    emptyText="No matching entities."
                    label="Other entity"
                    loading={results.isFetching}
                    onChange={(option) => {
                      setOther(option);
                      field.onChange(option ? Number(option.id) : undefined);
                    }}
                    onQueryChange={setQuery}
                    options={(results.data?.results ?? [])
                      .filter((item) => item.id !== entity.id)
                      .map((item) => ({
                        detail: [
                          toTitleCase(item.kind),
                          item.region?.name ?? item.country?.name,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                        id: item.id,
                        label: item.name,
                      }))}
                    placeholder="Search entities"
                    value={other}
                  />
                </FieldGroup>
              )}
            />
          </FormSection>
          <FormSection title="Record to keep">
            <Controller
              control={control}
              name="direction"
              render={({ field }) => (
                <ChoiceList
                  id="entity-merge-direction"
                  label="Record to keep"
                  name={field.name}
                  onChange={field.onChange}
                  options={[
                    {
                      description: other
                        ? `Retire ${other.label}.`
                        : "Retire the selected duplicate.",
                      label: `Keep ${entity.name}`,
                      value: "mergeFrom",
                    },
                    {
                      description: `Retire ${entity.name}.`,
                      label: other
                        ? `Keep ${other.label}`
                        : "Keep the duplicate",
                      value: "mergeInto",
                    },
                  ]}
                  value={field.value}
                />
              )}
            />
          </FormSection>
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}
