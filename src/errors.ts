export class OxPDFError extends Error {
  readonly statusCode: number | undefined;
  readonly responseBody: string | undefined;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: string,
  ) {
    super(message);
    this.name = "OxPDFError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
