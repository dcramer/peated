export function bottlePathPattern(id: number) {
  return new RegExp(`/bottles/${id}-[^/?#]+$`);
}

export function bottleHrefSelector(id: number) {
  return `a[href^="/bottles/${id}-"]`;
}

export function tastingPathPattern(id: number) {
  return new RegExp(`/tastings/${id}-[^/?#]+$`);
}
