import { zodResolver } from "@hookform/resolvers/zod";
import { AgeCheckConfigSchema } from "@peated/server/lib/badges/checks/ageCheck";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import TextField from "@peated/web/components/textField";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchema = z.infer<typeof AgeCheckConfigSchema>;

export default function AgeCheckConfigForm({
  onChange,
  initialData = {},
}: {
  onChange: (data: Partial<FormSchema>) => void;
  initialData?: Partial<FormSchema>;
}) {
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(AgeCheckConfigSchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    const subscription = watch((value, { name, type }) => onChange(value));
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <>
      <Form>
        <Fieldset>
          <TextField
            {...register("minAge", {
              setValueAs: (v) =>
                v === "" || !v ? null : Number.parseInt(v, 10),
            })}
            label="Min Bottle Age"
            type="number"
            min="1"
            max="100"
            suffixLabel="years"
            helpText="The minimum (inclusive) age of the bottle."
            placeholder="e.g. 5"
            error={errors.minAge}
          />
          <TextField
            {...register("maxAge", {
              setValueAs: (v) =>
                v === "" || !v ? null : Number.parseInt(v, 10),
            })}
            label="Max Bottle Age"
            type="number"
            min="1"
            max="100"
            suffixLabel="years"
            helpText="The maximum (inclusive) age of the bottle."
            placeholder="e.g. 5"
            error={errors.maxAge}
          />
        </Fieldset>
      </Form>
    </>
  );
}
