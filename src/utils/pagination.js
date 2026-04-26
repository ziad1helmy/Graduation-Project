/**
 * Pagination utility — resolves page/limit or skip/limit into a consistent object.
 *
 * Supports two calling conventions:
 *   1. page-based:  ?page=2&limit=10  → skip=10, limit=10, page=2
 *   2. skip-based:  ?skip=10&limit=10 → skip=10, limit=10, page=2  (derived)
 *
 * Page-based takes precedence if both are provided.
 * Returns a metadata object suitable for API responses.
 *
 * @param {object} query - req.query object
 * @param {number} [defaultLimit=10] - Default page size
 * @param {number} [maxLimit=100]    - Maximum allowed page size
 * @returns {{ skip: number, limit: number, page: number }}
 */
export function parsePagination(query, defaultLimit = 10, maxLimit = 100) {
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), maxLimit);

  if (query.page !== undefined) {
    const page = Math.max(parseInt(query.page) || 1, 1);
    const skip = (page - 1) * limit;
    return { skip, limit, page };
  }

  // Backward-compatible skip mode
  const skip = Math.max(parseInt(query.skip) || 0, 0);
  const page = Math.floor(skip / limit) + 1;
  return { skip, limit, page };
}

/**
 * Build the pagination metadata block returned in every paginated response.
 *
 * @param {number} total - Total number of matching documents
 * @param {number} page  - Current page number
 * @param {number} limit - Page size
 * @returns {{ total, page, limit, totalPages, hasNextPage, hasPrevPage }}
 */
export function paginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
