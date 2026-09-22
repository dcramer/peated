"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@peated/web/components/button.stylex";
import {
  EmptyState,
  LoadingList,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import {
  FormSection,
  FormStack,
} from "@peated/web/components/formLayout.stylex";
import { ItemList, ItemRow } from "@peated/web/components/itemList.stylex";
import { MemberAvatar } from "@peated/web/components/memberAvatar";
import TimeSince from "@peated/web/components/timeSince";
import { useORPC } from "@peated/web/lib/orpc/context";

export default function BlockedMembersPage() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const blocks = useQuery(
    orpc.users.blockList.queryOptions({ input: { user: "me" } }),
  );
  const unblock = useMutation({
    ...orpc.users.blockDelete.mutationOptions(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orpc.users.blockList.key() }),
  });

  return (
    <FormStack>
      <FormSection
        description="Blocked members cannot comment on or toast your tastings, or send you friend requests. You cannot interact with theirs either. Their content stays visible."
        title="Blocked members"
      >
        {blocks.isPending ? (
          <LoadingList label="Loading blocked members" rows={3} />
        ) : blocks.isError ? (
          <SectionError
            heading="Blocked members unavailable"
            onRetry={() => void blocks.refetch()}
          >
            Try again in a moment.
          </SectionError>
        ) : blocks.data.results.length === 0 ? (
          <EmptyState heading="No blocked members">
            Block a member from their profile if you do not want them to
            interact with you.
          </EmptyState>
        ) : (
          <ItemList ariaLabel="Blocked members">
            {blocks.data.results.map(({ createdAt, user }) => (
              <ItemRow
                action={
                  <Button
                    loading={
                      unblock.isPending && unblock.variables?.user === user.id
                    }
                    loadingLabel="Unblocking…"
                    onClick={() => unblock.mutate({ user: user.id })}
                    size="sm"
                    variant="tonal"
                  >
                    Unblock
                  </Button>
                }
                href={`/users/${user.username}`}
                key={user.id}
                leading={
                  <MemberAvatar
                    pictureUrl={user.pictureUrl}
                    username={user.username}
                  />
                }
                metadata={
                  <>
                    Blocked <TimeSince date={createdAt} />
                  </>
                }
                title={user.username}
              />
            ))}
          </ItemList>
        )}
      </FormSection>
    </FormStack>
  );
}
