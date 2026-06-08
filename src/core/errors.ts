export class ScrapingError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(`[${source}] ${message}`);
    this.name = "ScrapingError";
  }
}

export class CompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompatibilityError";
  }
}
