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
    orpc.externalSites.configured.create.mutationOptions(),
  );
  const [error, setError] = useState<string>();
  const [collection, setCollection] = useState<"reviews" | "store_prices">(
    "reviews",
  );
  const [allowLlmProcessing, setAllowLlmProcessing] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const textValue = (name: string) => {
      return z.string().catch("").parse(data.get(name));
    };
    try {
      const scraper = await create.mutateAsync({
        key: textValue("key"),
        name: textValue("name"),
        collection,
        indexUrl: textValue("indexUrl"),
        sampleUrls: textValue("sampleUrl")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        allowLlmProcessing,
      });
      router.push(`/admin/sites/${scraper.site.type}/configs`);
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
      <h1 className="my-6 text-3xl font-semibold text-white">Add source</h1>
      {error && <FormError values={[error]} />}
      <form onSubmit={submit} className="space-y-6">
        <Fieldset>
          <TextField name="name" label="Site name" required />
          <TextField
            name="key"
            label="Short name"
            helpText="Use lowercase words and hyphens. Peated uses this value in the page address."
            required
          />
          <label className="block">
            <span className="mb-2 block font-semibold">Content to collect</span>
            <select
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              value={collection}
              onChange={(event) =>
                setCollection(
                  event.target.value === "store_prices"
                    ? "store_prices"
                    : "reviews",
                )
              }
            >
              <option value="reviews">Reviews</option>
              <option value="store_prices">Store prices</option>
            </select>
          </label>
          <TextField
            name="indexUrl"
            type="url"
            label="List page"
            helpText="The page that links to review or product detail pages."
            required
          />
          <label className="block">
            <span className="mb-2 block font-semibold">
              Example detail pages
            </span>
            <textarea
              name="sampleUrl"
              rows={3}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              placeholder="One URL per line"
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowLlmProcessing}
              onChange={(event) => setAllowLlmProcessing(event.target.checked)}
            />
            <span>Allow AI to suggest parsing rules</span>
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
