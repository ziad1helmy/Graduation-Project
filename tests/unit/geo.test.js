/**
 * Tests for src/utils/geo.js — Haversine distance and location scoring.
 *
 * These are pure-function unit tests (no DB needed).
 */

import { describe, it, expect } from 'vitest';
import { calculateDistance, getLocationScore, findNearby, sortByProximity } from '../../src/utils/geo.js';

describe('geo.calculateDistance', () => {
  it('should return 0 for identical coordinates', () => {
    const loc = { latitude: 30.0444, longitude: 31.2357 };
    expect(calculateDistance(loc, loc)).toBe(0);
  });

  it('should calculate Cairo → Giza distance (~12-15 km)', () => {
    const cairo = { latitude: 30.0444, longitude: 31.2357 };
    const giza = { latitude: 29.987, longitude: 31.2118 };
    const distance = calculateDistance(cairo, giza);
    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(20);
  });

  it('should calculate Cairo → Alexandria distance (~180-220 km)', () => {
    const cairo = { latitude: 30.0444, longitude: 31.2357 };
    const alexandria = { latitude: 31.2001, longitude: 29.9187 };
    const distance = calculateDistance(cairo, alexandria);
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(250);
  });

  it('should handle antipodal points (~20000 km)', () => {
    const pointA = { latitude: 0, longitude: 0 };
    const pointB = { latitude: 0, longitude: 180 };
    const distance = calculateDistance(pointA, pointB);
    expect(distance).toBeGreaterThan(19000);
    expect(distance).toBeLessThan(21000);
  });
});

describe('geo.getLocationScore', () => {
  it('should return 100 for distance 0', () => {
    expect(getLocationScore(0, 100)).toBe(100);
  });

  it('should return 50 for half the max distance', () => {
    expect(getLocationScore(50, 100)).toBe(50);
  });

  it('should return 0 for distance beyond max', () => {
    expect(getLocationScore(150, 100)).toBe(0);
  });

  it('should return 0 for distance exactly at max', () => {
    expect(getLocationScore(100, 100)).toBe(0);
  });

  it('should return ~75 for 25% of max distance', () => {
    const score = getLocationScore(25, 100);
    expect(score).toBe(75);
  });
});

describe('geo.findNearby', () => {
  const hospital = { latitude: 30.0444, longitude: 31.2357 }; // Cairo center

  const donors = [
    { location: { latitude: 30.0637, longitude: 31.3303 } }, // Nasr City (~10 km)
    { location: { latitude: 29.987, longitude: 31.2118 } },   // Giza (~7 km)
    { location: { latitude: 31.2001, longitude: 29.9187 } },  // Alexandria (~200 km)
    { location: {} },                                           // No coordinates
  ];

  it('should find donors within 50 km radius', () => {
    const nearby = findNearby(donors, hospital, 50);
    expect(nearby).toHaveLength(2); // Nasr City + Giza
  });

  it('should return all donors when location is missing', () => {
    const nearby = findNearby(donors, null, 50);
    expect(nearby).toHaveLength(4);
  });

  it('should find all donors within 300 km radius', () => {
    const nearby = findNearby(donors, hospital, 300);
    expect(nearby).toHaveLength(3); // All except the one with no coordinates
  });
});

describe('geo.sortByProximity', () => {
  const hospital = { latitude: 30.0444, longitude: 31.2357 };

  it('should sort donors closest first', () => {
    const donors = [
      { location: { latitude: 31.2001, longitude: 29.9187 }, toObject: () => ({ name: 'far' }) },
      { location: { latitude: 30.0637, longitude: 31.3303 }, toObject: () => ({ name: 'near' }) },
    ];

    const sorted = sortByProximity(donors, hospital);
    expect(sorted[0].name).toBe('near');
    expect(sorted[1].name).toBe('far');
    expect(sorted[0].distance).toBeLessThan(sorted[1].distance);
  });

  it('should give Infinity distance to donors without coordinates', () => {
    const donors = [
      { location: {}, toObject: () => ({ name: 'no-coords' }) },
    ];
    const sorted = sortByProximity(donors, hospital);
    expect(sorted[0].distance).toBe(Infinity);
  });
});
