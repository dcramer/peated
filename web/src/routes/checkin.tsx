import { useLoaderData, useNavigate } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { FormEvent, useState } from "react";

import type { Bottle } from "../types";
import api, { ApiError } from "../lib/api";
import Layout from "../components/layout";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import FormField from "../components/formField";
import FormLabel from "../components/formLabel";
import Rating from "../components/rating";
import BottleCard from "../components/bottleCard";
import TextAreaField from "../components/textAreaField";
import RatingField from "../components/ratingField";
import Fieldset from "../components/fieldset";

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

function CheckinTags({
  value,
  onChange,
}: {
  value: string[];
  onChange: (newValue: string[]) => void;
}) {
  const tags = ["Bold", "Peaty", "Oak"];

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Flavors
      </Typography>

      <Stack direction="row" spacing={1}>
        {tags.map((t) => {
          const selected = value.indexOf(t) !== -1;
          return (
            <Chip
              key={t}
              label={t}
              icon={!selected ? <AddIcon /> : undefined}
              onClick={() => {
                if (selected) onChange(value.filter((v) => v !== t));
                else onChange([t, ...value]);
              }}
              variant={!selected ? "outlined" : undefined}
              onDelete={
                selected
                  ? () => onChange(value.filter((v) => v !== t))
                  : undefined
              }
            />
          );
        })}
      </Stack>
    </div>
  );
}

type FormData = {
  tastingNotes?: string;
  rating?: number;
};

export default function Checkin() {
  const { bottle } = useLoaderData() as LoaderData;

  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({});

  const [tags, setTags] = useState<string[]>([]);
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
          setError(await err.errorMessage());
        } else {
          console.error(err);
          setError("Internal error");
        }
      }
      if (checkin) navigate("/");
    })();
  };

  return (
    <Layout
      header={<FormHeader title="Record Tasting" onSave={onSubmit} />}
      gutter
    >
      <form className="mx-auto max-w-md" onSubmit={onSubmit}>
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
        </Fieldset>
      </form>
    </Layout>
  );
}
