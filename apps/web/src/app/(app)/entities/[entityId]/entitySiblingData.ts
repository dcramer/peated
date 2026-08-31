type EntitySiblingCandidate = { id: number; kind: string };
type EntitySiblingList<T extends EntitySiblingCandidate> = {
  results: readonly T[];
};

export function getEntitySiblings<T extends EntitySiblingCandidate>(
  entityId: number,
  siblingList?: EntitySiblingList<T>,
) {
  return (
    siblingList?.results
      .filter(
        (sibling) =>
          sibling.id !== entityId &&
          (sibling.kind === "distillery" || sibling.kind === "bottler"),
      )
      .slice(0, 4) ?? []
  );
}
