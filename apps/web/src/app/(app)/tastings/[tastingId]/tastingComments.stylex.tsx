"use client";

import type { Outputs } from "@peated/server/orpc/router";
import type { Comment } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  Button,
  ButtonLink,
  Field,
  ItemList,
  ItemRow,
  LoadingList,
  MemberAvatar,
  RowMenu,
  SectionError,
  Textarea,
  ValidationMessage,
} from "@peated/web/components";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../styles/tokens.stylex";

type CommentList = Outputs["comments"]["list"];

export function TastingComments({
  initialCommentList,
  tastingId,
}: {
  initialCommentList?: CommentList;
  tastingId: number;
}) {
  const orpc = useORPC();
  const { user } = useAuth();
  const [newComments, setNewComments] = useState<Comment[]>([]);
  const [deleted, setDeleted] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const commentList = useQuery({
    ...orpc.comments.list.queryOptions({ input: { tasting: tastingId } }),
    initialData: initialCommentList,
  });
  const createComment = useMutation(orpc.comments.create.mutationOptions());
  const deleteComment = useMutation(orpc.comments.delete.mutationOptions());
  const comments = uniqueComments([
    ...(commentList.data?.results ?? []),
    ...newComments,
  ]).filter((item) => !deleted.includes(item.id));

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = comment.trim();
    if (!user || !value || createComment.isPending) return;

    createComment.mutate(
      {
        comment: value,
        createdAt: new Date().toISOString(),
        tasting: tastingId,
      },
      {
        onSuccess: (created) => {
          setNewComments((items) => [
            ...items,
            { ...created, createdBy: user },
          ]);
          setComment("");
        },
      },
    );
  }

  if (commentList.error) {
    return (
      <SectionError
        heading="Comments are unavailable"
        onRetry={() => void commentList.refetch()}
      >
        Try loading this part of the tasting again.
      </SectionError>
    );
  }

  return (
    <div {...stylex.props(styles.thread)}>
      {user ? (
        <form onSubmit={submitComment} {...stylex.props(styles.form)}>
          <Field htmlFor="tasting-comment" label="Add a comment">
            <Textarea
              id="tasting-comment"
              onChange={(event) => setComment(event.currentTarget.value)}
              placeholder="Share a useful thought"
              required
              rows={3}
              value={comment}
            />
          </Field>
          {createComment.error ? (
            <ValidationMessage>{createComment.error.message}</ValidationMessage>
          ) : null}
          <div {...stylex.props(styles.formAction)}>
            <Button
              disabled={createComment.isPending}
              loading={createComment.isPending}
              size="sm"
              type="submit"
              variant="accent"
            >
              Post comment
            </Button>
          </div>
        </form>
      ) : (
        <ButtonLink href="/login" size="sm" variant="tonal">
          Sign in to comment
        </ButtonLink>
      )}

      {commentList.isPending ? (
        <LoadingList label="Loading tasting comments" rows={3} />
      ) : comments.length ? (
        <ItemList ariaLabel="Tasting comments">
          {comments.map((item) => {
            const canDelete = Boolean(
              user?.admin || user?.id === item.createdBy.id,
            );
            return (
              <ItemRow
                action={
                  canDelete ? (
                    <RowMenu
                      groups={[
                        [
                          {
                            disabled: deleteComment.isPending,
                            label: "Delete comment",
                            onSelect: () => {
                              deleteComment.mutate({ comment: item.id });
                              setDeleted((ids) => [...ids, item.id]);
                            },
                          },
                        ],
                      ]}
                      label={`${item.createdBy.username}'s comment`}
                    />
                  ) : undefined
                }
                description={item.comment}
                href={`/users/${item.createdBy.username}`}
                key={item.id}
                leading={
                  <MemberAvatar
                    pictureUrl={item.createdBy.pictureUrl}
                    username={item.createdBy.username}
                  />
                }
                metadata={<TimeSince date={item.createdAt} />}
                title={item.createdBy.username}
              />
            );
          })}
        </ItemList>
      ) : null}
    </div>
  );
}

function uniqueComments(comments: readonly Comment[]) {
  return [
    ...new Map(comments.map((comment) => [comment.id, comment])).values(),
  ];
}

const styles = stylex.create({
  thread: {
    display: "flex",
    maxWidth: "800px",
    flexDirection: "column",
    rowGap: space.x6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
  },
  formAction: { display: "flex", justifyContent: "flex-end" },
});
