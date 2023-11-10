import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import EmptyActivity from "~/components/emptyActivity";
import TastingList from "~/components/tastingList";

export async function loader({
  params: { entityId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(entityId);

  return json({
    tastingList: await trpc.tastingList.query({
      entity: Number(entityId),
    }),
  });
}

export default function EntityActivity() {
  const { tastingList } = useLoaderData<typeof loader>();

  if (!tastingList) return null;

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity to={`/search?tasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded any related spirit. You could be the
            first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
