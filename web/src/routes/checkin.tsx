import { useLoaderData, useNavigate } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { FormEvent, useState } from "react";

import type { Bottle } from "../types";
import api, { ApiError } from "../lib/api";
import Layout from "../components/layout";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import BottleCard from "../components/bottleCard";
import TextAreaField from "../components/textAreaField";
import RatingField from "../components/ratingField";
import Fieldset from "../components/fieldset";
import ImageField from "../components/imageField";
import TagsField from "../components/tagsField";

type LoaderData = {
  bottle: Bottle;
};

export const loader: LoaderFunction = async ({
  params: { bottleId },
}): Promise<LoaderData> => {
  if (!bottleId) throw new Error("Missing bottleId");
  const bottle = await api.get(`/bottles/${bottleId}`);

  return { bottle };
};

type FormData = {
  tastingNotes?: string;
  rating?: number;
};

export default function Checkin() {
  const { bottle } = useLoaderData() as LoaderData;

  const navigate = useNavigate();

  const [image, setImage] = useState<string | File | undefined>();
  const [formData, setFormData] = useState<FormData>({});

  const [error, setError] = useState<string | undefined>();

  const onSubmit = (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    e.preventDefault();

    (async () => {
      let checkin;
      try {
        checkin = await api.post("/checkins", {
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
        await api.post(`/checkins/${checkin.id}/image`, {
          data: {
            image,
          },
        });
      }
      if (checkin) navigate("/");
    })();
  };

  return (
    <Layout
      header={<FormHeader title="Record Tasting" onSave={onSubmit} />}
      gutter
      noMobileGutter
    >
      <form className="mx-auto max-w-xl" onSubmit={onSubmit}>
        <BottleCard bottle={bottle} />
        {error && <FormError values={[error]} />}

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
            name="tastingNotes"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            defaultValue={formData.tastingNotes}
            placeholder="Is it peated?"
          />

          <TagsField
            label="Flavor Profile"
            name="tags"
            onChange={(value) => setFormData({ ...formData, tags: value })}
            defaultValue={formData.tags}
          />

          <ImageField
            name="image"
            label="Picture"
            value={image}
            onChange={(e) =>
              setImage(e.target.files?.length ? e.target.files[0] : undefined)
            }
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
