"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import TextField from "@peated/web/components/textField";
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
  const [allowAiSuggestions, setAllowAiSuggestions] = useState(true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const textValue = (name: string) => {
      return z.string().catch("").parse(data.get(name));
    };
    try {
      const source = await create.mutateAsync({
        name: textValue("name"),
        kind,
        websiteUrl: textValue("websiteUrl"),
        sampleUrls: textValue("sampleUrls")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        allowAiSuggestions,
      });
      router.push(`/admin/sites/${source.site.type}/parsing`);
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-3">
      <Breadcrumbs
        pages={[
          { name: "Admin", href: "/admin" },
          { name: "Scrapers", href: "/admin/sites" },
          { name: "Add site", href: "/admin/sites/add", current: true },
        ]}
      />
      <h1 className="my-6 text-3xl font-semibold text-white">Add site</h1>
      {error && <FormError values={[error]} />}
      <form onSubmit={submit} className="space-y-6">
        <Fieldset>
          <TextField name="name" label="Site name" required />
          <TextField
            name="websiteUrl"
            type="url"
            label="Website"
            helpText="Start with the site's main page. Peated will look for a review or shop page."
            placeholder="https://example.com"
            required
          />
          <label className="block">
            <span className="mb-2 block font-semibold">Content to collect</span>
            <select
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value === "price" ? "price" : "review")
              }
            >
              <option value="review">Reviews</option>
              <option value="price">Store prices</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block font-semibold">
              {kind === "review"
                ? "Example review pages"
                : "Example product pages"}
            </span>
            <textarea
              name="sampleUrls"
              rows={3}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              placeholder="One URL per line"
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowAiSuggestions}
              onChange={(event) => setAllowAiSuggestions(event.target.checked)}
            />
            <span>Use AI to find the right page and create parsing rules</span>
          </label>
        </Fieldset>
        <div className="flex justify-end gap-2">
          <Button href="/admin/sites">Cancel</Button>
          <Button
            type="submit"
            color="highlight"
            loading={create.isPending}
            disabled={create.isPending}
          >
            Add site
          </Button>
        </div>
      </form>
    </div>
  );
}
