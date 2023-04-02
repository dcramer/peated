import { AccountCircle as AccountCircleIcon } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardHeader,
  TextField,
} from "@mui/material";
import { red } from "@mui/material/colors";
import { Bottle } from "../types";
import { getBottleDisplayName } from "../lib";

import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { searchBottles } from "../api";

type LoaderData = {
  bottles: Bottle[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const bottles = await searchBottles("");

  return { bottles };
};

export default function Search() {
  const { bottles } = useLoaderData() as LoaderData;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-end", width: "100%" }}>
        <AccountCircleIcon sx={{ color: "action.active", mr: 1, my: 0.5 }} />
        <TextField label="Search" variant="standard" sx={{ flex: 1 }} />
      </Box>
      {bottles.map((bottle) => {
        return (
          <Card>
            <CardActionArea href={`/b/${bottle.id}/checkin`}>
              <CardHeader
                avatar={
                  <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
                    L
                  </Avatar>
                }
                title={getBottleDisplayName(bottle)}
                subheader={bottle.producer?.name}
              />
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
