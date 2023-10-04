export class ResponseError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor({ status, reason, headers }: { status: number; reason: string; headers?: Record<string, string> }) {
    super(reason);
    this.status = status;
    this.headers = headers ?? {};
  }
}

export const NotFound = (reason: string): ResponseError =>
  new ResponseError({
    status: 404,
    reason,
  });

export const MethodNotAllowed = (reason: string, allowed: ReadonlyArray<string>): ResponseError =>
  new ResponseError({
    status: 405,
    reason,
    headers: {
      Allow: allowed.join(", "),
    },
  });

export const Unauthorized = (reason: string): ResponseError =>
  new ResponseError({
    status: 401,
    reason,
    headers: {
      "WWW-Authenticate": `Basic realm="Access to API endpoint" charset="UTF-8"`,
    },
  });

export const BadRequest = (reason: string): ResponseError =>
  new ResponseError({
    status: 404,
    reason,
  });
