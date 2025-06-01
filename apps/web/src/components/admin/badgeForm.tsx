"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isDefinedError } from "@orpc/client";
import {
  BADGE_CHECK_TYPE_LIST,
  BADGE_FORMULA_LIST,
  BADGE_TRACKER_LIST,
} from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import type { BadgeCheckInputSchema } from "@peated/server/schemas";
import { BadgeCheckSchema, BadgeInputSchema } from "@peated/server/schemas";
import type { BadgeCheck, BadgeCheckType } from "@peated/server/types";
import type { Badge } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import TextField from "@peated/web/components/textField";
import { logError } from "@peated/web/lib/log";
import { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import type { z } from "zod";
import Button from "../button";
import Form from "../form";
import ImageField from "../imageField";
import Legend from "../legend";
import SelectField from "../selectField";
import AgeCheckConfigForm from "./badgeConfigForms/ageCheckConfigForm";
import BottleCheckConfigForm from "./badgeConfigForms/bottleCheckConfigForm";
import CategoryCheckConfigForm from "./badgeConfigForms/categoryCheckConfigForm";
import EntityCheckConfigForm from "./badgeConfigForms/entityCheckConfigForm";
import RegionCheckConfigForm from "./badgeConfigForms/regionCheckConfigForm";
import AdminSidebar from "./sidebar";

type FormSchemaType = z.infer<typeof BadgeInputSchema>;

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
    FormSchemaType & {
      checks: BadgeCheck[];
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
    resolver: zodResolver(BadgeInputSchema),
    defaultValues: initialData,
  });

  const [error, setError] = useState<string | undefined>();
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [checks, setChecks] = useState<{
    items: (z.infer<typeof BadgeCheckInputSchema> & { id: number })[];
    counter: number;
  }>({
    items: (initialData.checks || []).map((c, i) => ({ ...c, id: i })),
    counter: initialData.checks ? initialData.checks.length : 0,
  });

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      const parsedChecks: BadgeCheck[] = [];
      for (const check of checks.items) {
        // TODO: handle errors
        parsedChecks.push(BadgeCheckSchema.parse(check));
      }

      await onSubmit({
        ...data,
        checks: parsedChecks,
        image,
      });
    } catch (err: any) {
      if (isDefinedError(err)) {
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
      {error && <FormError values={[error]} />}

      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
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
              setValueAs: (v) =>
                v === "" || !v ? null : Number.parseInt(v, 10),
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
                simple
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
                simple
                helpText="The XP formula to apply."
              />
            )}
          />
        </Fieldset>
      </Form>

      <div className="mb-4 mt-4 border-y border-slate-800 sm:rounded sm:border">
        <Legend title="Checks" />
        <div className="mb-8 mt-4 flex flex-wrap items-center gap-2 px-5">
          <div className="font-bold">Add:</div>
          {BADGE_CHECK_TYPE_LIST.map((t) => {
            return (
              <Button
                color="primary"
                key={t}
                onClick={(e) => {
                  e.preventDefault();

                  setChecks((value) => {
                    const counter = value.counter + 1;

                    setValue("checks", [
                      ...checks.items.map(({ type, config }) => ({
                        type,
                        config,
                      })),
                      {
                        type: t,
                        config: {},
                      },
                    ]);

                    return {
                      ...value,
                      items: [
                        ...value.items,
                        {
                          id: counter,
                          type: t,
                          config: {},
                        },
                      ],
                      counter,
                    };
                  });
                }}
              >
                {toTitleCase(t)}
              </Button>
            );
          })}
        </div>

        <ol className="px-3">
          {checks.items.map((check, index) => {
            return (
              <>
                {index > 0 && (
                  <li
                    key={`and-${index}`}
                    className="relative my-4 font-bold text-slate-500 opacity-60"
                  >
                    <div
                      className="absolute inset-0 flex items-center"
                      aria-hidden="true"
                    >
                      <div className="min-w-full border-t-2 border-slate-700" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-slate-950 px-2 text-lg uppercase">
                        And
                      </span>
                    </div>
                  </li>
                )}
                <li key={`${check.id}`} className="mb-4 flex gap-x-2">
                  <div className="p-3 font-semibold">#{index + 1}</div>
                  <div className="flex-grow">
                    <div className="flex items-center rounded-t bg-slate-700 p-3">
                      <h5 className="flex-grow font-semibold">
                        {toTitleCase(check.type)}
                      </h5>
                      <div className="self-end">
                        <Button
                          color="primary"
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();

                            setValue(
                              "checks",
                              checks.items
                                .filter((v) => v.id !== check.id)
                                .map(({ type, config }) => ({ type, config }))
                            );

                            setChecks((value) => {
                              return {
                                ...value,
                                items: value.items.filter(
                                  (v) => v.id !== check.id
                                ),
                              };
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {renderBadgeConfig({
                      checkType: check.type,
                      onChange: (data) => {
                        setValue(
                          "checks",
                          checks.items.map((c) => {
                            if (c.id === check.id) {
                              return { type: c.type, config: data };
                            }
                            return { type: c.type, config: c.config };
                          })
                        );
                        setChecks((value) => {
                          return {
                            ...value,
                            items: value.items.map((c) => {
                              if (c.id === check.id) {
                                return { ...c, config: data };
                              }
                              return c;
                            }),
                          };
                        });
                      },
                      initialData: check.config,
                    })}
                  </div>
                </li>
              </>
            );
          })}
        </ol>
      </div>
    </Layout>
  );
}

function renderBadgeConfig({
  checkType,
  initialData,
  onChange,
}: {
  checkType: BadgeCheckType;
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}) {
  switch (checkType) {
    case "age":
      return (
        <AgeCheckConfigForm onChange={onChange} initialData={initialData} />
      );
    case "bottle":
      return (
        <BottleCheckConfigForm onChange={onChange} initialData={initialData} />
      );
    case "category":
      return (
        <CategoryCheckConfigForm
          onChange={onChange}
          initialData={initialData}
        />
      );
    case "entity":
      return (
        <EntityCheckConfigForm onChange={onChange} initialData={initialData} />
      );
    case "region":
      return (
        <RegionCheckConfigForm onChange={onChange} initialData={initialData} />
      );
    case "everyTasting":
      return;
  }
}
