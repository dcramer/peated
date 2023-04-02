import {
  Avatar,
  Box,
  Chip,
  FormControl,
  Grid,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { getBottleDisplayName } from "../lib";
import { getBottle } from "../api";
import type { Bottle, User } from "../types";
import { useState } from "react";
import { Add as AddIcon } from "@mui/icons-material";

type LoaderData = {
  bottle: Bottle;
};

export const loader: LoaderFunction = async ({
  params: { bottleId },
}): Promise<LoaderData> => {
  if (!bottleId) throw new Error("Missing bottleId");
  const bottle = await getBottle(bottleId);

  return { bottle };
};

function CheckInTags({
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

function CheckInFriends({ value, onChange }: any) {
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

function CheckInRating() {
  return (
    <FormControl fullWidth>
      <Typography variant="h6" gutterBottom>
        Rating
      </Typography>
      <Rating
        name="simple-controlled"
        //   value={value}
        //   onChange={(event, newValue) => {
        //     setValue(newValue);
        //   }}
      />
    </FormControl>
  );
}

export default function Checkin() {
  const { bottle } = useLoaderData() as LoaderData;

  const [tags, setTags] = useState<string[]>([]);

  return (
    <Box
      sx={{
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography variant="h4" component="h4" gutterBottom>
        {getBottleDisplayName(bottle)}
      </Typography>

      <Box component="form" noValidate sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth label="Tasting Notes" variant="outlined" />
          </Grid>
          <Grid item xs={12}>
            {" "}
            <CheckInRating />
          </Grid>
          <Grid item xs={12}>
            <CheckInFriends value={[]} onChange={() => {}} />
          </Grid>

          <Grid item xs={12}>
            <CheckInTags value={tags} onChange={setTags} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
