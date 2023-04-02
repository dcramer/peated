import { Add as AddIcon } from "@mui/icons-material";
import { Box, Fab, Paper } from "@mui/material";
import type { Checkin } from "../types";
import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { listCheckins } from "../api";
import CheckinListItem from "../components/checkinListItem";

type LoaderData = {
  checkins: Checkin[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const checkins = await listCheckins();

  return { checkins };
};

export default function Activity() {
  const { checkins } = useLoaderData() as LoaderData;

  return (
    <Box sx={{ position: "relative", height: "100vh" }}>
      <Fab
        color="primary"
        aria-label="add"
        style={{
          position: "absolute",
          bottom: 16 + 56,
          right: 16,
        }}
        href="/search"
      >
        <AddIcon />
      </Fab>
      <Paper
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          height: "100vh",
          overflow: "auto",
        }}
      >
        {checkins.map((c) => (
          <CheckinListItem key={c.id} value={c} />
        ))}
      </Paper>
    </Box>
  );
}
