export class Redirect extends Error {
  path: string;

  constructor(path: string) {
    super(path);
    this.path = path;
    this.name = this.constructor.name;
  }
}
