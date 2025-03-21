"use client";

import type { Comment, User } from "@peated/server/types";
import { trpc } from "@peated/web/lib/trpc/client";
import { useEffect, useRef, useState } from "react";
import Button from "./button";
import Fieldset from "./fieldset";
import FormField from "./formField";
import MentionSuggestions from "./mentionSuggestions";
import TextArea from "./textArea";
import UserAvatar from "./userAvatar";

export default function TastingCommentForm({
  tastingId,
  user,
  onComment,
  replyToComment,
  onCancel,
}: {
  tastingId: number;
  user: User;
  onComment: (comment: Comment) => void;
  replyToComment?: Comment | null;
  onCancel?: () => void;
}) {
  const commentCreateMutation = trpc.commentCreate.useMutation();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for @ mention suggestions
  const [mentionState, setMentionState] = useState({
    isSearching: false,
    searchPosition: 0,
    searchQuery: "",
  });

  // Determine if this is a reply
  const isReply = !!replyToComment;

  // Get placeholder text based on whether this is a reply
  const placeholder = isReply
    ? `Reply to ${replyToComment?.createdBy.username}...`
    : "How envious are you?";

  // Focus the textarea when the component mounts (for reply mode)
  useEffect(() => {
    if (isReply && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isReply]);

  // Handle text changes and detect @ mentions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, comment: value }));
    setError(null);

    // Check for @ mentions
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionState({
        isSearching: true,
        searchPosition: mentionMatch.index!,
        searchQuery: mentionMatch[1],
      });
    } else {
      setMentionState({
        isSearching: false,
        searchPosition: 0,
        searchQuery: "",
      });
    }
  };

  // Handle selecting a user from the mention suggestions
  const handleSelectMention = (username: string) => {
    const { comment } = formData;
    const beforeMention = comment.substring(0, mentionState.searchPosition);
    const afterMention = comment.substring(
      mentionState.searchPosition + 1 + mentionState.searchQuery.length,
    );

    // Replace the partial @mention with the full username
    const newComment = `${beforeMention}@${username}${afterMention}`;

    setFormData({ comment: newComment });
    setMentionState({
      isSearching: false,
      searchPosition: 0,
      searchQuery: "",
    });

    // Focus back on textarea and place cursor after the inserted mention
    if (textAreaRef.current) {
      const newCursorPosition = beforeMention.length + username.length + 1;
      textAreaRef.current.focus();
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.selectionStart = newCursorPosition;
          textAreaRef.current.selectionEnd = newCursorPosition;
        }
      }, 0);
    }
  };

  // Extract mentioned usernames from the comment text
  const extractMentionedUsernames = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex) || [];
    return matches.map((match) => match.substring(1)); // Remove @ symbol
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (saving || !formData.comment.trim()) return;
    setSaving(true);

    try {
      // Extract mentioned usernames
      const mentionedUsernames = extractMentionedUsernames(formData.comment);

      // Prepare the comment data
      const data: any = {
        comment: formData.comment,
        tasting: tastingId,
        createdAt: new Date().toISOString(),
        mentionedUsernames, // Add mentioned usernames to the request
      };

      // If this is a reply, add the replyToId and modify the comment text
      if (isReply && replyToComment) {
        // Add a marker in the comment text to identify it as a reply
        data.comment = `[Reply to #${replyToComment.id}] ${data.comment}`;
        // Add the replyToId to the data
        data.replyToId = replyToComment.id;
      }

      const newComment = await commentCreateMutation.mutateAsync(data);

      onComment({
        ...newComment,
        createdBy: user,
      });
      setFormData({ comment: "" });

      if (onCancel) {
        onCancel();
      }
    } catch (error: any) {
      console.error("Error creating comment:", error);
      setError(error?.message || "Failed to post comment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`flex items-start space-x-2 px-3 sm:px-2 ${isReply ? "ml-12" : ""}`}
    >
      <div className="h-8 w-8 flex-shrink-0">
        <UserAvatar size={32} user={user} />
      </div>
      <div className="min-w-0 flex-auto">
        <form className="relative" onSubmit={handleSubmit}>
          <Fieldset>
            <FormField className="border border-slate-800">
              <label htmlFor="comment" className="sr-only">
                {isReply ? "Add your reply" : "Add your comment"}
              </label>
              <div className="relative">
                <TextArea
                  ref={textAreaRef}
                  rows={3}
                  name="comment"
                  id="comment"
                  required
                  placeholder={placeholder}
                  value={formData.comment}
                  onChange={handleTextChange}
                />

                {/* Mention suggestions */}
                <MentionSuggestions
                  query={mentionState.searchQuery}
                  onSelect={handleSelectMention}
                  visible={mentionState.isSearching}
                />
              </div>

              {error && (
                <div className="mt-2 text-sm text-red-500">{error}</div>
              )}

              {/* Spacer element to match the height of the toolbar */}
              <div className="py-2" aria-hidden="true">
                {/* Matches height of button in toolbar (1px border + 36px content height) */}
                <div className="py-px">
                  <div className="h-9" />
                </div>
              </div>
            </FormField>
          </Fieldset>

          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between px-4 py-3">
            <div className="flex-shrink-0 space-x-2">
              {onCancel && (
                <Button type="button" color="primary" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" color="primary" disabled={saving}>
                {isReply ? "Post Reply" : "Post Comment"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
