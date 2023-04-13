import { Add as AddIcon } from "@mui/icons-material";
import { Fab, Paper, Tab, Tabs } from "@mui/material";
import type { Checkin } from "../types";
import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import api from "../lib/api";
import CheckinListItem from "../components/checkinListItem";
import Layout from "../components/layout";
import ScrollView from "../components/scrollView";

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
    <Layout
      title="Activity"
      appBar={
        <Tabs variant="fullWidth" value={0}>
          <Tab label="Friends" />
          <Tab label="Nearby" />
          <Tab label="Global" />
        </Tabs>
      }
    >
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
      <ScrollView>
        {checkins.map((c) => (
          <CheckinListItem key={c.id} value={c} />
        ))}
      </ScrollView>
    </Layout>
  );
}
