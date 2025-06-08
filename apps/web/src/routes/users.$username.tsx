import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import UserAvatar from "@peated/web/components/userAvatar";
import UserFlavorDistributionChart from "@peated/web/components/userFlavorDistributionChart";
import UserLocationChart from "@peated/web/components/userLocationChart";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/users/$username")({
  component: UserLayoutPage,
});

function UserLayoutPage() {
  const { username } = Route.useParams();
  const { user: currentUser } = useAuth();
  const orpc = useORPC();

  const { data: user } = useSuspenseQuery(
    orpc.users.details.queryOptions({
      input: { user: username },
    })
  );

  const isPrivate =
    user.private &&
    currentUser &&
    user.id !== currentUser.id &&
    user.friendStatus !== "friends";

  return (
    <DefaultLayout>
      <div className="mb-4 flex min-w-full flex-wrap gap-y-4 lg:mb-8 lg:flex-nowrap">
        <div className="flex w-full justify-center lg:w-auto lg:justify-start">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 lg:w-auto lg:flex-auto lg:gap-y-2">
          <h3 className="self-center font-semibold text-4xl text-white leading-normal lg:self-start">
            {user.username}
          </h3>
          <div className="flex flex-col items-center gap-x-2 gap-y-2 self-center text-muted lg:flex-row lg:self-start">
            <div>
              {user.admin ? (
                <Chip size="small" color="highlight">
                  Admin
                </Chip>
              ) : user.mod ? (
                <Chip size="small" color="highlight">
                  Moderator
                </Chip>
              ) : null}
            </div>
          </div>
          <div className="flex justify-center lg:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="block font-bold text-white text-xl uppercase tracking-wide">
                {user.stats.tastings.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Tastings</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block font-bold text-white text-xl uppercase tracking-wide">
                {user.stats.bottles.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Bottles</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block font-bold text-white text-xl uppercase tracking-wide">
                {user.stats.collected.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Collected</span>
            </div>
            <div className="mb-4 pl-3 text-center">
              <span className="block font-bold text-white text-xl uppercase tracking-wide">
                {user.stats.contributions.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Contributions</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center lg:w-auto lg:items-end">
          {currentUser && (
            <div className="flex gap-x-2">
              {user.id !== currentUser.id ? (
                <div>Friend actions will be implemented</div>
              ) : (
                <>
                  <Button to="/settings" color="primary">
                    Edit Profile
                  </Button>
                  <div>Logout button will be implemented</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isPrivate ? (
        <EmptyActivity>This users profile is private.</EmptyActivity>
      ) : (
        <>
          <div className="mb-4 px-3 lg:mb-8 lg:px-0">
            <div>User badges will be implemented</div>
          </div>
          <div className="grid-cols mb-4 hidden grid-cols-1 gap-4 px-3 lg:grid lg:grid-cols-2 lg:px-0">
            <UserLocationChart userId={user.id} />
            <UserFlavorDistributionChart userId={user.id} />
          </div>
          <div className="hidden lg:block">
            <Tabs fullWidth border>
              <TabItem as={Link} to={`/users/${user.username}`} controlled>
                Activity
              </TabItem>
              <TabItem
                as={Link}
                to={`/users/${user.username}/favorites`}
                controlled
              >
                Favorites
              </TabItem>
            </Tabs>
          </div>
          <Outlet />
        </>
      )}
    </DefaultLayout>
  );
}
