import ChangeList from "@peated/web/components/changeList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import Tabs from "@peated/web/components/tabs";
import type { MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ context: { trpc } }) => {
    return { changeList: await trpc.changeList.query() };
  },
);

export const meta: MetaFunction = () => {
  return [
    {
      title: "Updates",
    },
  ];
};

export default function Updates() {
  const { changeList } = useLoaderData<typeof loader>();

  return (
    <Layout>
      <>
        <Tabs fullWidth>
          <Tabs.Item as={Link} to="/updates" controlled>
            Updates
          </Tabs.Item>
        </Tabs>
        {changeList.results.length > 0 ? (
          <ChangeList values={changeList.results} rel={changeList.rel} />
        ) : (
          <EmptyActivity>
            Looks like theres no updates in the system. That's odd.
          </EmptyActivity>
        )}
      </>
    </Layout>
  );
}
