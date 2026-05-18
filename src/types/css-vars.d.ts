/**
 * Augments React.CSSProperties to accept CSS custom properties (--var-name).
 * Without this, TypeScript rejects inline style objects like:
 *   style={{ '--block-color': '#ff0000' }}
 * This is a global module augmentation — it applies project-wide and
 * prevents future TS2353 errors for any CSS variable in JSX style props.
 */
import 'react'

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}
