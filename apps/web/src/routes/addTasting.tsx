import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ArrowDownIcon } from "@heroicons/react/20/solid";
import BottleCard from "../components/bottleCard";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import ImageField from "../components/imageField";
import Layout from "../components/layout";
import RangeField from "../components/rangeField";
import SelectField from "../components/selectField";
import TextAreaField from "../components/textAreaField";
import TextField from "../components/textField";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api, { ApiError } from "../lib/api";
import { toTitleCase } from "../lib/strings";
import type { Bottle, Paginated } from "../types";

type Tag = {
  name: string;
  count: number;
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
  const { bottleId } = useParams();
  const { data: bottle } = useSuspenseQuery(
    ["bottles", bottleId],
    (): Promise<Bottle> => api.get(`/bottles/${bottleId}`),
  );

  const {
    data: { results: suggestedTags },
  } = useSuspenseQuery(
    ["bottles", bottleId, "suggestedTags"],
    (): Promise<Paginated<Tag>> =>
      api.get(`/bottles/${bottleId}/suggestedTags`),
  );

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
    >
      <form className="mx-auto my-6 max-w-xl" onSubmit={onSubmit}>
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <BottleCard bottle={bottle} color="highlight" />
        </div>

        <Fieldset>
          <RangeField
            label="Rating"
            required
            name="rating"
            value={formData.rating}
            onChange={(value) => {
              setFormData((formData) => ({
                ...formData,
                rating: value,
              }));
            }}
          />

          <SelectField
            label="Flavors"
            name="tags"
            targetOptions={5}
            options={suggestedTags.map((t) => ({
              id: t.name,
              name: toTitleCase(t.name),
              count: t.count,
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

          <TextAreaField
            label="Tasting Notes"
            name="notes"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            value={formData.notes}
            placeholder="Is it peated?"
          />

          <ImageField
            name="image"
            label="Picture"
            value={image}
            onChange={(e) =>
              setImage(e.target.files?.length ? e.target.files[0] : undefined)
            }
          />

          <div className="bg-highlight my-4 px-4 py-3 text-black">
            <div className="flex items-center">
              <div className="flex-1">
                <h2 className="font-medium">Vintage Details</h2>
                <p className="text-sm">Is this bottle a specific vintage?</p>
              </div>
              <ArrowDownIcon className="h-8 w-8 text-slate-700" />
            </div>
          </div>
          <TextField
            type="number"
            name="vintageYear"
            label="Year"
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
      </form>
    </Layout>
  );
}
