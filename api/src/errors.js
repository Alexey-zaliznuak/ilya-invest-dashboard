export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message) => new HttpError(400, 'invalid_input', message);
export const notFound = (message) => new HttpError(404, 'not_found', message);
export const conflict = (message) => new HttpError(409, 'duplicate', message);
