import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLoaderData, useNavigate } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import api from "../lib/api";
import type { Bottle, User } from "../types";
import { FormEvent, useState } from "react";
import { Add as AddIcon } from "@mui/icons-material";
import Layout from "../components/layout";

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
    <FormControl fullWidth>
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

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    (async () => {
      await api.post("/checkins", {
        data: {
          ...formData,
          bottle: bottle.id,
        },
      });
      navigate(`/`);
    })();
  };

  return (
    <Layout appBar="show X/save up here like the instas">
      <Typography variant="h4" component="h4" gutterBottom>
        {bottle.name}
        {bottle.series && <em>{bottle.series}</em>}
      </Typography>
      <Box component="form" sx={{ mt: 3 }} onSubmit={onSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              onChange={(e) => {
                setFormData({ ...formData, tastingNotes: e.target.value });
              }}
              fullWidth
              label="Tasting Notes"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12}>
            <CheckinRating
              onChange={(e) => {
                setFormData({ ...formData, rating: e.target.value });
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <CheckinTags value={tags} onChange={setTags} />
          </Grid>
          <Grid item xs={12}>
            <Button fullWidth variant="contained" size="large" type="submit">
              Save
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
}
