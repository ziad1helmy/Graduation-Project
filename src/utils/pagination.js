/**
 * Pagination utility — resolves page/limit into a consistent object.
 *
 * @param {object} query - req.query object
 * @param {number} [defaultLimit=10] - Default page size
 * @param {number} [maxLimit=100]    - Maximum allowed page size
 * @returns {{ offset: number, limit: number, page: number }}
 */
export function parsePagination(query, defaultLimit = 10, maxLimit = 100) {
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), maxLimit);
  const page = Math.max(parseInt(query.page) || 1, 1);
  const offset = (page - 1) * limit;
  return { offset, limit, page };
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
    currentPage: page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
