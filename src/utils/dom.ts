/**
 * Shorthand for document.getElementById.
 * Returns the element cast to the intersection of HTMLElement subtypes
 * most commonly needed (input value, innerHTML, etc.).
 */
export function $(id: string): HTMLInputElement & HTMLElement {
  return document.getElementById(id) as HTMLInputElement & HTMLElement;
}

/**
 * HTML-escape a string to prevent XSS when inserting into innerHTML.
 */
export function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
