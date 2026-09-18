/** Iconify emits style="" on SVG roots; strict CSP reports even empty styles.
 * Remove only this no-op attribute. Actual styles and CSP directives stay intact.
 */
export function stripEmptyIconStyles(html: string): string {
  return html.replace(/(<svg\b[^>]*?)\sstyle=""(?=[\s>])/g, '$1')
}
