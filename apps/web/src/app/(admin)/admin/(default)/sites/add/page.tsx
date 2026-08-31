"use client";

import { AdminButton } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import {
  AdminFieldset,
  AdminForm,
  AdminFormActions,
  AdminFormError,
  AdminSelectField,
  AdminTextareaField,
  AdminTextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const create = useMutation(
    orpc.externalSites.scrapeSources.create.mutationOptions(),
  );
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState<"review" | "price">("review");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const textValue = (name: string) =>
      z.string().catch("").parse(data.get(name));

    try {
      const source = await create.mutateAsync({
        name: textValue("name"),
        kind,
        websiteUrl: textValue("websiteUrl"),
        sampleUrls: textValue("sampleUrls")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      router.push(`/admin/sites/${source.site.type}`);
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Scrapers", href: "/admin/sites" },
          { label: "Add site", href: "/admin/sites/add", current: true },
        ]}
      />
      <AdminPageHeader
        title="Add site"
        description="Peated will find the list, detail fields, and next pages. You will review the result before collection starts."
      />
      {error ? <AdminFormError values={[error]} /> : null}
      <AdminForm isSubmitting={create.isPending} onSubmit={submit}>
        <AdminFieldset>
          <AdminTextField name="name" label="Site name" required />
          <AdminTextField
            name="websiteUrl"
            type="url"
            label="Website"
            helpText="Start with the site's main page. Peated will look for a review or shop page."
            placeholder="https://example.com"
            required
          />
          <AdminSelectField
            label="Content to collect"
            name="kind"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value === "price" ? "price" : "review")
            }
            options={[
              { label: "Reviews", value: "review" },
              { label: "Store prices", value: "price" },
            ]}
          />
          <AdminTextareaField
            name="sampleUrls"
            rows={3}
            label={
              kind === "review"
                ? "Example review pages"
                : "Example product pages"
            }
            helpText="Leave this blank unless the site is hard to navigate. Peated will find examples from the main page first."
            placeholder="One URL per line"
          />
        </AdminFieldset>
        <AdminFormActions>
          <AdminButton href="/admin/sites">Cancel</AdminButton>
          <AdminButton
            type="submit"
            variant="accent"
            loading={create.isPending}
            disabled={create.isPending}
          >
            Add site
          </AdminButton>
        </AdminFormActions>
      </AdminForm>
    </AdminPage>
  );
}
