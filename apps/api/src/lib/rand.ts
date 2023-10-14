export function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function choose<T>(choices: T[]): T {
  const index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

export function sample<T>(choices: T[] | readonly T[], num: number): T[] {
  const samples = [...choices];
  const length = choices.length;
  num = Math.max(Math.min(num, length), 0);
  const last = length - 1;
  for (let index = 0; index < num; index++) {
    const rand = random(index, last);
    const temp = samples[index];
    samples[index] = samples[rand];
    samples[rand] = temp;
  }
  return samples.slice(0, num);
}

export function shuffle<T>(choices: T[] | readonly T[]): T[] {
  const value = [...choices];
  let currentIndex = choices.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [value[currentIndex], value[randomIndex]] = [
      value[randomIndex],
      value[currentIndex],
    ];
  }

  return value;
}
