import {
  json,
  type LoaderFunction,
  type V2_MetaFunction,
} from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { Breadcrumbs } from "~/components/breadcrumbs";

export const loader: LoaderFunction = async ({ request, context, params }) => {
  invariant(params.storeId);

  const store = await context.api.get(`/stores/${params.storeId}`);

  return json({ store });
};

export const meta: V2_MetaFunction = ({ data }) => {
  return [
    {
      title: data.store.name,
    },
  ];
};

export default function AdminStoreDetails() {
  const { store } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Stores",
            to: "/admin/stores",
          },
          {
            name: store.name,
            to: `/admin/stores/${store.id}`,
            current: true,
          },
        ]}
      />
      <Outlet context={{ store }} />
    </div>
  );
}
