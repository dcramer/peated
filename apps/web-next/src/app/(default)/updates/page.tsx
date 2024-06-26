import ChangeList from "@peated/web/components/changeList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc";

export default function Page() {
  const [changeList] = trpc.changeList.useSuspenseQuery();

  return (
    <>
      {changeList.results.length > 0 ? (
        <ChangeList values={changeList.results} rel={changeList.rel} />
      ) : (
        <EmptyActivity>
          Looks like theres no updates in the system. That's odd.
        </EmptyActivity>
      )}
    </>
  );
}
