"use client";

import type { Comment, User } from "@peated/server/types";
import { trpc } from "@peated/web/lib/trpc/client";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import CommentEntry from "./commentEntry";
import TastingCommentForm from "./tastingCommentForm";

// Helper function to extract mentioned usernames from comment text
function extractMentionedUsernames(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex) || [];
  return matches.map((match) => match.substring(1)); // Remove @ symbol
}

export default function TastingCommentList({
  user,
  tastingId,
  newValues = [],
}: {
  user?: User | null;
  tastingId: number;
  newValues?: Comment[];
}) {
  const [data] = trpc.commentList.useSuspenseQuery({
    tasting: tastingId,
  });

  const commentDeleteMutation = trpc.commentDelete.useMutation();

  // Track locally deleted comment IDs (comments that were deleted during this session)
  const [locallyDeletedComments, setLocallyDeletedComments] = useState<
    Record<number, boolean>
  >({});
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [newComments, setNewComments] = useState<Comment[]>([]);

  // Combine all comments
  const allComments = [...(data?.results || []), ...newValues, ...newComments];

  // Create a map of parent comments to their replies
  const commentMap = new Map<number, Comment[]>();
  const topLevelComments: Comment[] = [];

  // First pass: identify top-level comments and build a map of parent IDs to replies
  allComments.forEach((comment) => {
    if (comment.replyToId) {
      // This is a reply
      const replies = commentMap.get(comment.replyToId) || [];
      replies.push(comment);
      commentMap.set(comment.replyToId, replies);
    } else {
      // This is a top-level comment
      topLevelComments.push(comment);
    }
  });

  // Function to handle a new comment or reply
  const handleNewComment = (comment: Comment) => {
    setNewComments((prev) => [...prev, comment]);
    setReplyingTo(null);
  };

  // Function to handle reply button click
  const handleReply = (commentId: number) => {
    const comment = allComments.find((c) => c.id === commentId);
    if (comment) {
      setReplyingTo(comment);
    }
  };

  // Function to handle comment deletion
  const handleDeleteComment = (commentId: number) => {
    // Mark the comment as locally deleted
    setLocallyDeletedComments((prev) => ({
      ...prev,
      [commentId]: true,
    }));

    // Call the server to delete the comment
    commentDeleteMutation.mutate(commentId);
  };

  // Function to check if a comment is deleted (either from server or locally)
  const isCommentDeleted = (comment: Comment): boolean => {
    return (
      comment.deleted === true || locallyDeletedComments[comment.id] === true
    );
  };

  return (
    <>
      {/* Comment form for top-level comments */}
      {user && !replyingTo && (
        <TastingCommentForm
          tastingId={tastingId}
          user={user}
          onComment={handleNewComment}
        />
      )}

      <ul className="my-4 space-y-4">
        <AnimatePresence>
          {topLevelComments.map((comment) => {
            const isAuthor = user?.id === comment.createdBy.id;
            const replies = commentMap.get(comment.id) || [];
            const isDeleted = isCommentDeleted(comment);

            // Sort replies by creation date
            replies.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );

            // Extract mentioned usernames from the comment text
            const mentionedUsernames = extractMentionedUsernames(
              comment.comment,
            );

            return (
              <React.Fragment key={comment.id}>
                {/* Main comment */}
                <CommentEntry
                  as={motion.li}
                  layout
                  className="relative flex items-start space-x-2 text-white"
                  createdAt={comment.createdAt}
                  createdBy={comment.createdBy}
                  text={comment.comment}
                  commentId={comment.id}
                  mentionedUsernames={mentionedUsernames}
                  canDelete={!isDeleted && (user?.admin || isAuthor)}
                  onDelete={() => handleDeleteComment(comment.id)}
                  onReply={user ? () => handleReply(comment.id) : undefined}
                  isDeleted={isDeleted}
                />

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="ml-12 mt-2 space-y-2">
                    {replies.map((reply) => {
                      const isReplyAuthor = user?.id === reply.createdBy.id;
                      const replyMentionedUsernames = extractMentionedUsernames(
                        reply.comment,
                      );
                      const isReplyDeleted = isCommentDeleted(reply);

                      return (
                        <CommentEntry
                          key={reply.id}
                          as={motion.li}
                          layout
                          className="relative flex items-start space-x-2 text-white"
                          createdAt={reply.createdAt}
                          createdBy={reply.createdBy}
                          text={reply.comment}
                          commentId={reply.id}
                          mentionedUsernames={replyMentionedUsernames}
                          canDelete={
                            !isReplyDeleted && (user?.admin || isReplyAuthor)
                          }
                          onDelete={() => handleDeleteComment(reply.id)}
                          onReply={
                            user ? () => handleReply(comment.id) : undefined
                          }
                          isDeleted={isReplyDeleted}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Reply form */}
                {user && replyingTo && replyingTo.id === comment.id && (
                  <div className="mt-2">
                    <TastingCommentForm
                      tastingId={tastingId}
                      user={user}
                      replyToComment={replyingTo}
                      onComment={handleNewComment}
                      onCancel={() => setReplyingTo(null)}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </AnimatePresence>
      </ul>
    </>
  );
}
