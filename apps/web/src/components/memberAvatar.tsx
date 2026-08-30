import { Avatar, type AvatarSize } from "./avatar.stylex";

export type MemberAvatarProps = {
  pictureUrl?: string | null;
  size?: AvatarSize;
  username: string;
};

/** Supplies member data to the shared avatar. */
export function MemberAvatar({
  pictureUrl,
  size,
  username,
}: MemberAvatarProps) {
  return (
    <Avatar
      imageUrl={pictureUrl}
      initials={username.slice(0, 2).toLocaleUpperCase()}
      size={size}
    />
  );
}
