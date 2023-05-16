import { FormEvent, useState } from "react";
import type { LoaderFunction } from "react-router-dom";
import { useLoaderData, useNavigate } from "react-router-dom";

import { ArrowDownIcon } from "@heroicons/react/20/solid";
import BottleCard from "../components/bottleCard";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import ImageField from "../components/imageField";
import Layout from "../components/layout";
import RatingField from "../components/ratingField";
import { Option } from "../components/selectField";
import TagsField from "../components/tagsField";
import TextAreaField from "../components/textAreaField";
import TextField from "../components/textField";
import api, { ApiError } from "../lib/api";
import { toTitleCase } from "../lib/strings";
import type { Bottle } from "../types";

type Flavor = {
  name: string;
  count: number;
};

type LoaderData = {
  bottle: Bottle;
  flavorList: Flavor[];
};

export const loader: LoaderFunction = async ({
  params: { bottleId },
}): Promise<LoaderData> => {
  if (!bottleId) throw new Error("Missing bottleId");
  const bottle = await api.get(`/bottles/${bottleId}`);

  const { results: flavorList } = await api.get(
    `/bottles/${bottleId}/suggestedTags`,
  );

  return { bottle, flavorList };
};

type FormData = {
  notes?: string;
  rating?: number;
  tags?: string[];

  edition?: string;
  vintageYear?: number;
  barrel?: number;
};

export default function AddTasting() {
  const { bottle, flavorList } = useLoaderData() as LoaderData;

  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [image, setImage] = useState<string | File | undefined>();
  const [formData, setFormData] = useState<FormData>({});

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();

    if (saving) return;
    setSaving(true);

    (async () => {
      let tasting;
      try {
        tasting = await api.post("/tastings", {
          data: {
            ...formData,
            bottle: bottle.id,
          },
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          console.error(err);
          setError("Internal error");
        }
      }
      // TODO(dcramer): graceful failure here
      if (image) {
        try {
          await api.post(`/tastings/${tasting.id}/image`, {
            data: {
              image,
            },
          });
        } catch (err) {
          console.error(err);
          // TODO show some kind of alert, ask them to reusubmit image
        }
      }
      setSaving(false);
      if (tasting) navigate("/");
    })();
  };

  return (
    <Layout
      header={
        <FormHeader
          title="Record Tasting"
          onSave={onSubmit}
          saveDisabled={saving}
        />
      }
      gutter
      noMobileGutter
    >
      <form className="mx-auto max-w-xl" onSubmit={onSubmit}>
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <BottleCard bottle={bottle} />
        </div>

        <Fieldset>
          <RatingField
            label="How was it?"
            required
            onChange={(value) => {
              setFormData({ ...formData, rating: value });
            }}
          />

          <TextAreaField
            label="Any notes?"
            name="notes"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            defaultValue={formData.notes}
            placeholder="Is it peated?"
          />

          <TagsField
            label="Flavor Profile"
            name="tags"
            suggestedOptions={flavorList.map<Option>((f) => ({
              id: f.name,
              name: f.name,
            }))}
            onChange={(value) =>
              setFormData({ ...formData, tags: value.map((t: any) => t.id) })
            }
            value={formData.tags?.map((t) => ({
              id: t,
              name: toTitleCase(t),
            }))}
            multiple
          />

          <ImageField
            name="image"
            label="Picture"
            value={image}
            onChange={(e) =>
              setImage(e.target.files?.length ? e.target.files[0] : undefined)
            }
          />

          <div className="bg-slate-900 p-3 ">
            <div className="mb-4 flex items-center">
              <div className="flex-1">
                <h2 className="font-medium">Additional Details</h2>
                <p className="text-sm">
                  If this is a specific series or barrel, feel free to note it
                  below.
                </p>
              </div>
              <ArrowDownIcon className="h-8 w-8 text-slate-700" />
            </div>
            <Fieldset>
              <TextField
                type="number"
                name="vintageYear"
                label="Vintage"
                value={formData.vintageYear}
                placeholder="e.g. 2023"
              />
              <TextField
                name="edition"
                label="Edition"
                value={formData.edition}
                placeholder="e.g. Healthy Spirits"
              />
              <TextField
                type="number"
                name="barrel"
                label="Barrel No."
                value={formData.barrel}
                placeholder="e.g. 56"
              />
            </Fieldset>
          </div>
        </Fieldset>
      </form>
    </Layout>
  );
}
