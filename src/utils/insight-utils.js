import { logger } from './logger.js';

export const computeGrowth = (current, prev) => {
  if (current === 0 && prev === 0) return '0%';
  if (prev === 0) return '+100%';
  if (current === 0) return '-100%';
  const pct = ((current - prev) / prev * 100).toFixed(0);
  return (pct >= 0 ? '+' : '') + pct + '%';
};

export const safeEngine = async (engineFn, engineName = 'unknown') => {
  try {
    return await engineFn();
  } catch (e) {
    logger.error(`AI engine "${engineName}" failed`, { error: e?.message });
    return null;
  }
};
