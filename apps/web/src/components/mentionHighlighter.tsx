"use client";

import Link from "@peated/web/components/link";

type MentionHighlighterProps = {
  text: string;
  mentionedUsernames?: string[];
};

export default function MentionHighlighter({
  text,
  mentionedUsernames = [],
}: MentionHighlighterProps) {
  if (!mentionedUsernames.length) {
    return <>{text}</>;
  }

  // Create a regex pattern to match all mentioned usernames
  const mentionPattern = new RegExp(
    `@(${mentionedUsernames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );

  // Split the text by mentions and render each part
  const parts = text.split(mentionPattern);

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part is a mentioned username (will be after @ in the original regex)
        if (mentionedUsernames.includes(part)) {
          return (
            <Link
              key={index}
              href={`/users/${part}`}
              className="font-medium text-blue-400 hover:underline"
            >
              @{part}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}
