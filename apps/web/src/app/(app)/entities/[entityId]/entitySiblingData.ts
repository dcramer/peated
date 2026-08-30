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
