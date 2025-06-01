import { zodResolver } from "@hookform/resolvers/zod";
import { CATEGORY_LIST } from "@peated/server/constants";
import { CategoryCheckConfigSchema } from "@peated/server/lib/badges/checks/categoryCheck";
import { notEmpty } from "@peated/server/lib/filter";
import { formatCategoryName } from "@peated/server/lib/format";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import SelectField from "@peated/web/components/selectField";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchema = z.infer<typeof CategoryCheckConfigSchema>;

const categoryList = CATEGORY_LIST.map((c) => ({
  id: c,
  name: formatCategoryName(c),
}));

export default function CategoryCheckConfigForm({
  onChange,
  initialData = {},
}: {
  onChange: (data: Partial<FormSchema>) => void;
  initialData?: Partial<FormSchema>;
}) {
  const {
    control,
    watch,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(CategoryCheckConfigSchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    // Cant be asked to fix this right now.
    // @ts-ignore
    const subscription = watch((value, { name, type }) => onChange(value));
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <>
      <Form>
        <Fieldset>
          <Controller
            name="category"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.category}
                label="Category"
                multiple
                placeholder="e.g. Single Malt"
                helpText="The kind of spirit."
                simple
                required
                options={categoryList}
                onChange={(value) =>
                  onChange(value ? value.map((c) => c.id).filter(notEmpty) : [])
                }
                value={
                  value
                    ? value.map((c) => ({
                        id: c,
                        name: formatCategoryName(c),
                      }))
                    : []
                }
              />
            )}
          />
        </Fieldset>
      </Form>
    </>
  );
}
