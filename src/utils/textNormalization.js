/**
 * Arabic & English Text Normalization Utility
 *
 * Purpose: Normalize Arabic and English text for consistent searching and storage.
 *
 * Normalization Rules:
 * - Converts Arabic diacritics and variants to canonical forms
 * - Removes extra spaces
 * - Converts to lowercase
 * - Preserves Arabic + English letters and numbers
 *
 * Usage:
 *   const normalized = normalizeArabic('أحمد محمد');
 *   // Result: 'احمد محمد'
 */

/**
 * Normalize Arabic text for consistent searching and storage
 *
 * Mappings:
 *   - أ, إ, آ → ا (all Alef variants to standalone Alef)
 *   - ة → ه (Teh Marbuta to Heh)
 *   - ى → ي (Alef Maksura to Yeh)
 *
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text (lowercase, trimmed, canonical forms)
 */
export const normalizeArabic = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Replace Alef variants with standalone Alef
    .replace(/[أإآ]/g, 'ا')
    // Replace Teh Marbuta with Heh
    .replace(/ة/g, 'ه')
    // Replace Alef Maksura with Yeh
    .replace(/ى/g, 'ي')
    // Remove diacritics (fatha, damma, kasra, etc.)
    .replace(/[\u064B-\u0652]/g, '')
    // Normalize spaces (remove extra spaces)
    .replace(/\s+/g, ' ')
    // Trim leading/trailing spaces
    .trim()
    // Convert to lowercase (for English letters, Arabic not affected)
    .toLowerCase();
};

/**
 * Check if text contains only Arabic letters
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains only Arabic
 */
export const isArabicOnly = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /^[\u0600-\u06FF\s]+$/.test(text);
};

/**
 * Check if text contains only English letters
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains only English
 */
export const isEnglishOnly = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /^[a-zA-Z\s]+$/.test(text);
};

/**
 * Check if text is valid (Arabic + English + spaces + dots + dashes only, no special chars)
 *
 * Allows:
 *   - Arabic letters: ا-ي, ء-ة
 *   - English letters: a-z, A-Z
 *   - Spaces
 *   - Dots (.)
 *   - Dashes (-)
 *
 * Rejects:
 *   - Numbers: 0-9
 *   - Special characters: @#$%^&*()
 *
 * @param {string} text - Text to validate
 * @returns {boolean} True if text is valid
 */
export const isValidArabicEnglishText = (text) => {
  if (!text || typeof text !== 'string') return false;
  // Allow Arabic letters, English letters, spaces, dots, and dashes
  return /^[\u0600-\u06FFa-zA-Z\s\.\-]+$/.test(text);
};

/**
 * Extract keywords from text for search optimization
 *
 * Splits text by spaces and returns array of normalized keywords
 *
 * @param {string} text - Text to extract keywords from
 * @returns {array} Array of normalized keywords
 */
export const extractKeywords = (text) => {
  if (!text || typeof text !== 'string') return [];

  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => normalizeArabic(word));
};

/**
 * Create a search regex for flexible text matching
 *
 * Example:
 *   createSearchRegex('احمد') returns /احمد/i
 *   This will match 'احمد', 'أحمد', 'احمـد' after normalization
 *
 * @param {string} query - Search query
 * @returns {RegExp} Regex for case-insensitive search
 */
export const createSearchRegex = (query) => {
  if (!query || typeof query !== 'string') return /./; // Match nothing useful

  const normalized = normalizeArabic(query);
  // Escape special regex characters
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i'); // Case-insensitive
};

export default {
  normalizeArabic,
  isArabicOnly,
  isEnglishOnly,
  isValidArabicEnglishText,
  extractKeywords,
  createSearchRegex,
};
