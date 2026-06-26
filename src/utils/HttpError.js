/**
 * HttpError — a typed error that carries an HTTP status code and optional
 * details. The global error handler in src/app.js maps this to a JSON response.
 *
 * Usage:
 *   throw new HttpError(404, 'hospital.error_not_found');
 *   throw new HttpError(400, 'Invalid input', { field: 'email' });
 */
export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}
