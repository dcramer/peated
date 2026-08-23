export function arraysEqual<T>(one: T[], two: T[]) {
  if (one.length !== two.length) return false;
  for (let i = 0; i < one.length; i++) {
    if (one[i] !== two[i]) return false;
  }
  return true;
}

export function objectsShallowEqual<T extends object>(object1: T, object2: T) {
  const entries1 = Object.entries(object1);
  const entries2 = Object.entries(object2);

  if (entries1.length !== entries2.length) {
    return false;
  }

  const values2 = new Map(entries2);
  for (const [key, value] of entries1) {
    if (value !== values2.get(key)) {
      return false;
    }
  }

  return true;
}
