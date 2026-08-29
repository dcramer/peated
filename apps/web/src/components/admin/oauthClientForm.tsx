"use client";

import {
  OAuthClientInputSchema,
  type OAuthClientSchema,
} from "@peated/server/schemas";
import {
  AdminFieldset as Fieldset,
  AdminFormPage as FormPage,
  AdminTextareaField as TextAreaField,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";

import { useAdminFormSubmit } from "./useAdminFormSubmit";

export function parseOAuthClientRedirectUris(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const OAuthClientFormSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(120),
    redirectUris: z.string().trim().min(1, "Add at least one redirect URI."),
  })
  .superRefine((value, ctx) => {
    const result = OAuthClientInputSchema.safeParse({
      name: value.name,
      redirectUris: parseOAuthClientRedirectUris(value.redirectUris),
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === "redirectUris") {
          ctx.addIssue({
            code: "custom",
            path: ["redirectUris"],
            message: issue.message,
          });
        }
      }
    }
  });

type FormData = z.infer<typeof OAuthClientFormSchema>;
type OAuthClientInput = z.infer<typeof OAuthClientInputSchema>;
type OAuthClient = z.infer<typeof OAuthClientSchema>;

export function getOAuthClientFormDefaults(
  initialData?: Partial<OAuthClient>,
): FormData {
  return {
    name: initialData?.name ?? "",
    redirectUris: initialData?.redirectUris?.join("\n") ?? "",
  };
}

export default function OAuthClientForm({
  onSubmit,
  initialData,
  title = "Register OAuth Client",
}: {
  onSubmit: (data: OAuthClientInput) => Promise<void>;
  initialData?: Partial<OAuthClient>;
  title?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(OAuthClientFormSchema),
    defaultValues: getOAuthClientFormDefaults(initialData),
  });
  const { error, submit } = useAdminFormSubmit<FormData>(async (data) => {
    await onSubmit(
      OAuthClientInputSchema.parse({
        name: data.name,
        redirectUris: parseOAuthClientRedirectUris(data.redirectUris),
      }),
    );
  });

  return (
    <FormPage
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(submit)}
      title={title}
    >
      <Fieldset>
        {initialData?.clientId && (
          <TextField
            name="clientId"
            label="Client ID"
            value={initialData.clientId}
            readOnly
            helpText="Public identifier; OAuth clients do not have a secret."
          />
        )}
        <TextField
          {...register("name")}
          label="Name"
          placeholder="e.g. Peated CLI"
          error={errors.name}
          required
        />
        <TextAreaField
          {...register("redirectUris")}
          label="Redirect URIs"
          helpText="One URI per line. Use HTTPS, or HTTP with 127.0.0.1 or [::1] for local clients."
          error={errors.redirectUris}
          rows={6}
          required
        />
      </Fieldset>
    </FormPage>
  );
}
