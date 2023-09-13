import type { Change, Paginated } from "@peated/shared/types";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import ChangeList from "~/components/changeList";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";

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

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Updates",
    },
  ];
};

export default function Updates() {
  const { user } = useAuth();

  return (
    <Layout>
      <>
        <Tabs fullWidth>
          {user && (
            <Tabs.Item as={Link} to="/?view=friends">
              Friends
            </Tabs.Item>
          )}
          <Tabs.Item as={Link} to="/">
            Global
          </Tabs.Item>
          <Tabs.Item as={Link} to="/updates" controlled>
            Updates
          </Tabs.Item>
        </Tabs>
        <QueryBoundary>
          <UpdatesContent />
        </QueryBoundary>
      </>
    </Layout>
  );
}
