import {
  json,
  type LoaderFunction,
  type V2_MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import StoreTable from "~/components/admin/storeTable";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";

export const loader: LoaderFunction = async ({ request, context }) => {
  const url = new URL(request.url);
  const page = url.searchParams.get("page");
  const storeList = await context.api.get("/stores", {
    page,
    sort: "name",
  });

  return json({ storeList });
};

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Stores",
    },
  ];
};

export default function AdminStores() {
  const { storeList } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex justify-center">
        <h1 className="flex-1 font-medium">Stores</h1>
        <Button color="primary" to="/admin/stores/add">
          Add Store
        </Button>
      </div>
      {storeList.results.length > 0 ? (
        <StoreTable storeList={storeList.results} rel={storeList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
