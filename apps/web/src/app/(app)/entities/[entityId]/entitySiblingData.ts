type EntitySiblingCandidate = { id: number };
type EntitySiblingList<T extends EntitySiblingCandidate> = {
  results: readonly T[];
};

export function getEntitySiblings<T extends EntitySiblingCandidate>(
  entityId: number,
  siblingList?: EntitySiblingList<T>,
) {
  return (
    siblingList?.results
      .filter((sibling) => sibling.id !== entityId)
      .slice(0, 4) ?? []
  );
}

export function shouldShowEntitySiblingOverview<
  T extends EntitySiblingCandidate,
>({
  entityId,
  error,
  ownerId,
  pending,
  siblingList,
}: {
  entityId: number;
  error: boolean;
  ownerId?: number | null;
  pending: boolean;
  siblingList?: EntitySiblingList<T>;
}) {
  return Boolean(
    ownerId &&
    (pending || error || getEntitySiblings(entityId, siblingList).length),
  );
}
