"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import { BottleMergeSchema } from "@peated/server/schemas";
import {
  ChoiceList,
  FieldGroup,
  FormNotice,
  FormSection,
  FormStack,
  SearchSelect,
  SelectedBottleSummary,
  type SearchPickerOption,
} from "@peated/web/components/designSystem/components";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof BottleMergeSchema>;

export default function MergeBottle(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = use(props.params);
  return (
    <ModRequired>
      <MergeBottleForm bottleId={bottleId} />
    </ModRequired>
  );
}

function MergeBottleForm({ bottleId }: { bottleId: string }) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { flash } = useFlashMessages();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const prefilledId = Number(searchParams.get("other") ?? 0) || null;
  const prefilledDirection =
    searchParams.get("direction") === "mergeFrom" ? "mergeFrom" : "mergeInto";
  const [query, setQuery] = useState("");
  const [other, setOther] = useState<SearchPickerOption | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const results = useQuery(
    orpc.bottles.list.queryOptions({
      input: {
        limit: 25,
        query,
        sort: query ? "rank" : "-tastings",
      },
    }),
  );
  const prefilledBottle = useQuery({
    ...orpc.bottles.details.queryOptions({
      input: { bottle: prefilledId ?? 0 },
    }),
    enabled: prefilledId !== null,
  });
  const merge = useMutation({
    ...orpc.bottles.merge.mutationOptions(),
    onSuccess: (nextBottle) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.bottles.details.key({
          input: { bottle: nextBottle.id },
        }),
      });
    },
  });
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setValue,
  } = useForm<FormSchemaType>({
    defaultValues: { direction: prefilledDirection },
    resolver: zodResolver(BottleMergeSchema),
  });

  useEffect(() => {
    if (!prefilledBottle.data || other) return;
    const option = {
      detail: getBottleMetadata(prefilledBottle.data),
      id: prefilledBottle.data.id,
      label: formatBottleDisplayName(prefilledBottle.data),
    };
    setOther(option);
    setValue("bottleId", prefilledBottle.data.id);
  }, [other, prefilledBottle.data, setValue]);

  const submit: SubmitHandler<FormSchemaType> = async (data) => {
    setSubmitError(undefined);
    try {
      const nextBottle = await merge.mutateAsync({
        bottle: bottle.id,
        direction: data.direction,
        other: data.bottleId,
      });
      flash(<div>Bottles merged successfully.</div>);
      router.push(`/bottles/${nextBottle.id}`);
    } catch (error) {
      setSubmitError(
        getFormErrorMessage(error, { allowAnyErrorMessage: true }),
      );
    }
  };

  return (
    <WorkflowScreen
      onSave={handleSubmit(submit)}
      saveLabel="Merge bottles"
      saving={isSubmitting}
      title="Merge bottle"
    >
      <form onSubmit={handleSubmit(submit)}>
        <FormStack>
          <SelectedBottleSummary
            bottleId={bottle.peatedId}
            imageUrl={bottle.imageUrl}
            metadata={getBottleMetadata(bottle)}
            name={formatBottleDisplayName(bottle)}
          />
          {submitError ? <FormNotice>{submitError}</FormNotice> : null}
          <FormSection title="Duplicate bottle">
            <Controller
              control={control}
              name="bottleId"
              render={({ field }) => (
                <FieldGroup
                  error={errors.bottleId?.message}
                  label="Other bottle"
                  required
                >
                  <SearchSelect
                    emptyText="No matching bottles."
                    label="Other bottle"
                    loading={results.isFetching}
                    onChange={(option) => {
                      setOther(option);
                      field.onChange(option ? Number(option.id) : undefined);
                    }}
                    onQueryChange={setQuery}
                    options={(results.data?.results ?? [])
                      .filter((item) => item.id !== bottle.id)
                      .map((item) => ({
                        detail: getBottleMetadata(item),
                        id: item.id,
                        label: formatBottleDisplayName(item),
                      }))}
                    placeholder="Search bottles"
                    value={other}
                  />
                </FieldGroup>
              )}
            />
          </FormSection>
          <FormSection title="Bottle to keep">
            <Controller
              control={control}
              name="direction"
              render={({ field }) => (
                <ChoiceList
                  id="bottle-merge-direction"
                  label="Bottle to keep"
                  name={field.name}
                  onChange={field.onChange}
                  options={[
                    {
                      description: other
                        ? `Retire ${other.label} (${formatPeatedId("bottle", Number(other.id))}).`
                        : "Retire the selected duplicate.",
                      label: `Keep ${formatBottleDisplayName(bottle)} (${bottle.peatedId})`,
                      value: "mergeFrom",
                    },
                    {
                      description: `Retire ${formatBottleDisplayName(bottle)} (${bottle.peatedId}).`,
                      label: other
                        ? `Keep ${other.label} (${formatPeatedId("bottle", Number(other.id))})`
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
