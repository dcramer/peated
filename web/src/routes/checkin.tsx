import { Form, useLoaderData, useNavigate } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { FormEvent, useState } from "react";

import type { Bottle, User } from "../types";
import api, { ApiError } from "../lib/api";
import Layout from "../components/layout";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import FormField from "../components/formField";
import FormLabel from "../components/formLabel";
import HelpText from "../components/helpText";
import TextArea from "../components/textArea";

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

function CheckinFriends({ value, onChange }: any) {
  const friends: User[] = [
    {
      id: "1",
      displayName: "Gavin",
    },
    {
      id: "2",
      displayName: "Rahul",
    },
  ];

  return (
    <FormControl fullWidth>
      <Typography variant="h6" gutterBottom>
        Tag Friends
      </Typography>
      <Stack direction="row" spacing={1}>
        {friends.map((f) => (
          <Chip
            key={f.id}
            avatar={<Avatar>{f.displayName.substring(0, 1)}</Avatar>}
            label={f.displayName}
          />
        ))}
      </Stack>
    </FormControl>
  );
}

function CheckinRating({ ...props }) {
  return (
    <FormControl fullWidth {...props}>
      <Typography variant="h6" gutterBottom>
        Rating
      </Typography>
      <Rating precision={0.5} max={5} size="large" {...props} />
    </FormControl>
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
      header={
        <FormHeader
          title={bottle.name}
          subtitle={bottle.series}
          onSave={onSubmit}
        />
      }
    >
      <Form onSubmit={onSubmit} className="sm:mx-auto sm:w-full sm:max-w-md">
        {error && <FormError values={[error]} />}
        <FormField>
          <FormLabel htmlFor="stagtastingNotesedAge">Tasting Notes</FormLabel>
          <TextArea
            name="tastingNotes"
            id="tastingNotes"
            onChange={(e) =>
              setFormData({ ...formData, [e.target.name]: e.target.value })
            }
            defaultValue={formData.tastingNotes}
          />
        </FormField>
        {/*
          <Grid item xs={12}>
            <CheckinRating
              required
              onChange={(e) => {
                setFormData({ ...formData, rating: e.target.value });
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <CheckinTags value={tags} onChange={setTags} />
          </Grid> */}
      </Form>
    </Layout>
  );
}
