export function bottlePathPattern(id: number) {
  return new RegExp(`/bottles/${id}-[^/?#]+$`);
}

export function bottleHrefSelector(id: number) {
  return `a[href^="/bottles/${id}-"]`;
}
