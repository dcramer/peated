import { Add as AddIcon } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Container,
  Fab,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { Checkin } from "../types";
import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import api from "../lib/api";
import CheckinListItem from "../components/checkinListItem";

type LoaderData = {
  checkins: Checkin[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const checkins = await api.get("/checkins");

  return { checkins };
};

export default function Activity() {
  const { checkins } = useLoaderData() as LoaderData;

  return (
    <Box
      sx={{
        position: "relative",
        height: "100vh",
        bgcolor: "background.paper",
      }}
    >
      <AppBar component="nav" position="static">
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ p: 1, textAlign: "center" }}
        >
          Activity
        </Typography>
        <Tabs variant="fullWidth" value={0}>
          <Tab label="Friends" />
          <Tab label="Nearby" />
          <Tab label="Global" />
        </Tabs>
      </AppBar>
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
      <Paper>
        {checkins.map((c) => (
          <CheckinListItem key={c.id} value={c} />
        ))}
      </Paper>
    </Box>
  );
}
