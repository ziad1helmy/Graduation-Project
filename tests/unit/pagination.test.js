/**
 * Tests for src/utils/pagination.js
 *
 * Pure unit tests — no DB needed.
 */

import { describe, it, expect } from 'vitest';
import { parsePagination, paginationMeta } from '../../src/utils/pagination.js';

describe('parsePagination', () => {
  it('should default to page 1, limit 10', () => {
    const result = parsePagination({});
    expect(result).toEqual({ skip: 0, limit: 10, page: 1 });
  });

  it('should parse page and limit from query', () => {
    const result = parsePagination({ page: '3', limit: '20' });
    expect(result).toEqual({ skip: 40, limit: 20, page: 3 });
  });

  it('should clamp limit to maxLimit', () => {
    const result = parsePagination({ page: '1', limit: '500' }, 10, 100);
    expect(result.limit).toBe(100);
  });

  it('should enforce minimum page of 1', () => {
    const result = parsePagination({ page: '0' });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('should enforce minimum limit of 1', () => {
    const result = parsePagination({ limit: '-5' });
    expect(result.limit).toBe(1);
  });

  it('should support skip-based mode', () => {
    const result = parsePagination({ skip: '20', limit: '10' });
    expect(result.skip).toBe(20);
    expect(result.page).toBe(3); // derived: floor(20/10) + 1
  });

  it('should prefer page over skip when both are provided', () => {
    const result = parsePagination({ page: '2', skip: '50', limit: '10' });
    expect(result.skip).toBe(10); // page wins
    expect(result.page).toBe(2);
  });
});

describe('paginationMeta', () => {
  it('should calculate total pages correctly', () => {
    const meta = paginationMeta(55, 1, 10);
    expect(meta.totalPages).toBe(6);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(false);
  });

  it('should handle last page', () => {
    const meta = paginationMeta(55, 6, 10);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(true);
  });

  it('should handle single page', () => {
    const meta = paginationMeta(5, 1, 10);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(false);
  });

  it('should handle empty results', () => {
    const meta = paginationMeta(0, 1, 10);
    expect(meta.totalPages).toBe(1);
    expect(meta.total).toBe(0);
  });
});
