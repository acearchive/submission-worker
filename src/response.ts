export const created = () => new Response(undefined, { status: 201 });

export const endpointNotFound = () => new Response(undefined, { status: 404 });

export const methodNotAllowed = (allowed: ReadonlyArray<string>) =>
  new Response(undefined, {
    status: 405,
    headers: {
      Allow: allowed.join(", "),
    },
  });

export const unauthorized = () =>
  new Response(undefined, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="Access to API endpoint" charset="UTF-8"`,
    },
  });

export const badRequest = (reason: string) =>
  new Response(reason, {
    status: 400,
  });
