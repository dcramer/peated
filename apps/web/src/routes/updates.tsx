import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import ChangeList from "../components/changeList";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";
import useAuth from "../hooks/useAuth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import api from "../lib/api";
import { Change, Paginated } from "../types";

const UpdatesContent = () => {
  const { data } = useQuery({
    queryKey: ["updates"],
    queryFn: (): Promise<Paginated<Change>> => api.get("/changes"),
  });

  if (!data) return null;

  return (
    <>
      {data.results.length > 0 ? (
        <ChangeList values={data.results} />
      ) : (
        <EmptyActivity>
          Looks like theres no updates in the system. That's odd.
        </EmptyActivity>
      )}
    </>
  );
};

export default function Updates() {
  const { user } = useAuth();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const isOnline = useOnlineStatus();

  return (
    <Layout>
      {isOnline ? (
        <>
          <Tabs fullWidth>
            {user && <Tabs.Item to="/?view=friends">Friends</Tabs.Item>}
            <Tabs.Item to="/">Global</Tabs.Item>
            <Tabs.Item to="/updates" controlled>
              Updates
            </Tabs.Item>
          </Tabs>
          <QueryBoundary>
            <UpdatesContent />
          </QueryBoundary>
        </>
      ) : (
        <EmptyActivity>
          You'll need to connect to the internet see activity.
        </EmptyActivity>
      )}
    </Layout>
  );
}
