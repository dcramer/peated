import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import ChangeList from "~/components/changeList";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { useOnlineStatus } from "~/hooks/useOnlineStatus";
import type { Change, Paginated } from "~/types";

const UpdatesContent = () => {
  const api = useApi();
  const { data } = useQuery({
    queryKey: ["changes"],
    queryFn: (): Promise<Paginated<Change>> => api.get("/changes"),
  });

  if (!data) return null;

  return (
    <>
      {data.results.length > 0 ? (
        <ChangeList values={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>
          Looks like theres no updates in the system. That's odd.
        </EmptyActivity>
      )}
    </>
  );
};

export async function loader({ context }: LoaderArgs) {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery(
    ["changes"],
    (): Promise<Paginated<Change>> => context.api.get("/changes"),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function Updates() {
  const { user } = useAuth();
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
