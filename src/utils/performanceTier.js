/**
 * performanceTier.js — FluxAura Studio Hardware Capability Detection
 *
 * Detects the device's rendering capability and returns one of three tiers:
 *   'full'     — Desktop with ≥4 GB RAM (or unknown non-mobile): all effects enabled.
 *   'balanced' — Mid-range or mobile device (4 GB mobile, 2–4 GB desktop): filter
 *                animations slowed, karaoke RAF throttled to 30 fps.
 *   'lite'     — Low-end device (≤1 GB RAM, or low-core mobile): GPU-heavy filter
 *                animations disabled, karaoke RAF throttled to 20 fps.
 *
 * Used by:
 *   - App.jsx  (editor): applies data-perf-tier on document.documentElement
 *   - publishUtils.js: embeds equivalent detection inline into the published player
 */

export const TIER_FULL     = 'full'
export const TIER_BALANCED = 'balanced'
export const TIER_LITE     = 'lite'

/**
 * Detect the current device's performance tier.
 * Uses navigator.deviceMemory (Chromium), navigator.hardwareConcurrency,
 * and mobile UA detection as a fallback for iOS Safari (no deviceMemory API).
 * @returns {'full'|'balanced'|'lite'}
 */
export function detectTier() {
  const mem   = navigator.deviceMemory || 0   // 0 = unknown (iOS Safari, Firefox)
  const cores = navigator.hardwareConcurrency || 2
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  let tier = TIER_FULL

  if      (mem > 0 && mem <= 1)             tier = TIER_LITE
  else if (mem > 0 && mem <= 2)             tier = TIER_BALANCED
  else if (mem > 0 && mem <= 4 && isMobile) tier = TIER_BALANCED
  else if (mem === 0 && isMobile)           tier = TIER_BALANCED  // iOS Safari: safe default

  // Cap by CPU core count
  if (cores <= 2 && tier === TIER_FULL) tier = TIER_BALANCED

  return tier
}

/**
 * Apply the detected tier as a data attribute on <html> so CSS can target it.
 * Also sets data-reduced-motion if the OS prefers-reduced-motion media query is active.
 * @param {'full'|'balanced'|'lite'} tier
 */
export function applyTierToDocument(tier) {
  document.documentElement.setAttribute('data-perf-tier', tier)
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) document.documentElement.setAttribute('data-reduced-motion', '1')
}

/** @returns {boolean} */
export function getPrefersReducedMotion() {
  return !!(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}
