/**
 * Wrap a raw LaTeX string with $ delimiters for react-latex-next.
 * - If the string already starts with a math delimiter ($, $$, \(, \[), pass it through as-is
 *   so existing cards stored with delimiters keep working.
 * - Otherwise wrap with $...$ (inline math).
 */
export function wrapLatex(s: string | undefined): string {
    if (!s) return '';
    const t = s.trim();
    if (
        t.startsWith('$') ||
        t.startsWith('\\(') ||
        t.startsWith('\\[')
    ) {
        return t; // already has delimiters
    }
    return `$${t}$`;
}
