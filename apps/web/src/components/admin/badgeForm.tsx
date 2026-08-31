"use client";

import {
  BADGE_CHECK_TYPE_LIST,
  BADGE_FORMULA_LIST,
  BADGE_TRACKER_LIST,
} from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import {
  BadgeCheckInputSchema,
  BadgeCheckSchema,
  BadgeInputSchema,
} from "@peated/server/schemas";
import type { BadgeCheckType } from "@peated/server/types";
import { type Badge } from "@peated/server/types";
import {
  AdminFieldset as Fieldset,
  AdminFormError as FormError,
  AdminFormPage as FormPage,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import ImageField from "../imageField";
import SelectField from "../selectField";
import { AdminButton as Button } from "./adminButton.stylex";
import { BadgeCheckEditor, BadgeCheckItem } from "./badgeCheckEditor.stylex";
import AgeCheckConfigForm from "./badgeConfigForms/ageCheckConfigForm";
import BottleCheckConfigForm from "./badgeConfigForms/bottleCheckConfigForm";
import CategoryCheckConfigForm from "./badgeConfigForms/categoryCheckConfigForm";
import EntityCheckConfigForm from "./badgeConfigForms/entityCheckConfigForm";
import RegionCheckConfigForm from "./badgeConfigForms/regionCheckConfigForm";
import { useAdminFormSubmit } from "./useAdminFormSubmit";

const BadgeFormInputSchema = BadgeInputSchema.extend({
  checks: z
    .array(BadgeCheckInputSchema)
    .min(1, "At least one check is required.")
    .superRefine((checks, context) => {
      checks.forEach((check, index) => {
        const result = BadgeCheckSchema.safeParse(check);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            context.addIssue({ ...issue, path: [index, ...issue.path] });
          });
        }
      });
    }),
});

type FormSchemaType = z.infer<typeof BadgeFormInputSchema>;
type BadgeCheckInput = z.infer<typeof BadgeCheckInputSchema>;
type BadgeCheckItem = BadgeCheckInput & { id: number };

function createBadgeCheckItem(
  type: BadgeCheckType,
  id: number,
): BadgeCheckItem {
  return { ...BadgeCheckInputSchema.parse({ type, config: {} }), id };
}

function withoutItemId({ id: _id, ...check }: BadgeCheckItem): BadgeCheckInput {
  return check;
}

export default function BadgeForm({
  onSubmit,
  initialData = {
    maxLevel: 25,
    checks: [],
  },
  title = "Add Badge",
  edit = false,
}: {
  onSubmit: SubmitHandler<
    z.infer<typeof BadgeInputSchema> & {
      image: HTMLCanvasElement | null;
    }
  >;
  initialData?: Partial<Badge>;
  title?: string;
  edit?: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BadgeFormInputSchema),
    defaultValues: initialData,
  });

  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [checks, setChecks] = useState<{
    items: BadgeCheckItem[];
    counter: number;
  }>({
    items: (initialData.checks || []).map((c, i) => ({ ...c, id: i })),
    counter: initialData.checks ? initialData.checks.length : 0,
  });

  const { error, submit } = useAdminFormSubmit<FormSchemaType>(async (data) => {
    const parsedData = BadgeInputSchema.parse(data);
    await onSubmit({ ...parsedData, image });
  });

  return (
    <FormPage
      afterForm={
        <BadgeCheckEditor
          error={
            errors.checks ? (
              <FormError
                values={[
                  "Add at least one check and complete each check's required fields.",
                ]}
              />
            ) : null
          }
          actions={BADGE_CHECK_TYPE_LIST.map((type) => (
            <Button
              variant="default"
              key={type}
              onClick={(event) => {
                event.preventDefault();
                setChecks((value) => {
                  const counter = value.counter + 1;
                  const items = [
                    ...value.items,
                    createBadgeCheckItem(type, counter),
                  ];
                  setValue("checks", items.map(withoutItemId));
                  return { items, counter };
                });
              }}
            >
              {toTitleCase(type)}
            </Button>
          ))}
        >
          {checks.items.map((check, index) => (
            <BadgeCheckItem
              index={index}
              key={check.id}
              title={toTitleCase(check.type)}
              removeAction={
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(event) => {
                    event.preventDefault();
                    const items = checks.items.filter(
                      (item) => item.id !== check.id,
                    );
                    setValue("checks", items.map(withoutItemId));
                    setChecks((value) => ({
                      ...value,
                      items: value.items.filter((item) => item.id !== check.id),
                    }));
                  }}
                >
                  Remove
                </Button>
              }
            >
              {renderBadgeConfig({
                check,
                onChange: (updatedCheck) => {
                  setValue(
                    "checks",
                    checks.items.map((item) =>
                      withoutItemId(item.id === check.id ? updatedCheck : item),
                    ),
                  );
                  setChecks((value) => ({
                    ...value,
                    items: value.items.map((item) =>
                      item.id === check.id ? updatedCheck : item,
                    ),
                  }));
                },
              })}
            </BadgeCheckItem>
          ))}
        </BadgeCheckEditor>
      }
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(submit)}
      title={title}
    >
      <Fieldset>
        <TextField
          {...register("name")}
          label="Name"
          placeholder="e.g. Islay Scotch"
          error={errors.name}
        />

        <ImageField
          name="image"
          label="Image"
          onChange={(value) => setImage(value)}
          imageWidth={1024 / 2}
          imageHeight={1024 / 2}
        />

        <TextField
          {...register("maxLevel", {
            setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
          })}
          label="Max Level"
          type="number"
          min="1"
          max="100"
          helpText="The maximum level for this badge."
          placeholder="e.g. 25"
          error={errors.maxLevel}
        />
      </Fieldset>

      <Fieldset>
        <Controller
          name="tracker"
          control={control}
          render={({ field: { onChange, value, ref, ...field } }) => (
            <SelectField
              {...field}
              label="Tracker"
              helpText="The tracker determines which attributes are recorded for XP. Only new unique items grant XP."
              onChange={(value) => onChange(value?.id)}
              value={
                value
                  ? {
                      id: value,
                      name: toTitleCase(value),
                    }
                  : undefined
              }
              options={BADGE_TRACKER_LIST.map((t) => ({
                id: t,
                name: toTitleCase(t),
              }))}
            />
          )}
        />
        <Controller
          name="formula"
          control={control}
          render={({ field: { onChange, value, ref, ...field } }) => (
            <SelectField
              {...field}
              label="Formula"
              onChange={(value) => onChange(value?.id)}
              value={
                value
                  ? {
                      id: value,
                      name: toTitleCase(value),
                    }
                  : undefined
              }
              options={BADGE_FORMULA_LIST.map((t) => ({
                id: t,
                name: toTitleCase(t),
              }))}
              helpText="The XP formula to apply."
            />
          )}
        />
      </Fieldset>
    </FormPage>
  );
}

function renderBadgeConfig({
  check,
  onChange,
}: {
  check: BadgeCheckItem;
  onChange: (check: BadgeCheckItem) => void;
}) {
  switch (check.type) {
    case "age":
      return (
        <AgeCheckConfigForm
          onChange={(config) => onChange({ ...check, config })}
          initialData={check.config}
        />
      );
    case "bottle":
      return (
        <BottleCheckConfigForm
          onChange={(config) => onChange({ ...check, config })}
          initialData={check.config}
        />
      );
    case "category":
      return (
        <CategoryCheckConfigForm
          onChange={(config) => onChange({ ...check, config })}
          initialData={check.config}
        />
      );
    case "entity":
      return (
        <EntityCheckConfigForm
          onChange={(config) => onChange({ ...check, config })}
          initialData={check.config}
        />
      );
    case "region":
      return (
        <RegionCheckConfigForm
          onChange={(config) => onChange({ ...check, config })}
          initialData={check.config}
        />
      );
    case "everyTasting":
      return;
  }
}
