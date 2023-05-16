export function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function choose<T>(choices: T[]): T {
  const index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

export function sample<T>(choices: T[], num: number): T[] {
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
