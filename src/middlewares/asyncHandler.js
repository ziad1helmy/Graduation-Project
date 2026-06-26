/**
 * Async handler wrapper — eliminates the need for try/catch/next in every
 * Express async route handler. Pass an async function and any thrown error
 * is forwarded to Express's error-handling middleware.
 *
 * Usage:
 *   export const getThing = asyncHandler(async (req, res) => {
 *     const thing = await Thing.findById(req.params.id);
 *     if (!thing) throw new ApiError(404, 'Not found');
 *     response.success(res, 200, 'success', thing);
 *   });
 *
 * @param {Function} fn - An async (req, res, next) handler
 * @returns {Function} - An Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};
