/**
 * Monvixx — DOM helpers: get element by id, show temporary hint message.
 */

/** Return element by id; throws if missing. */
export function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

/** Set hint text and clear it after 2.5s (for form feedback). */
export function flashHint(node, message) {
  node.textContent = message;
  if (!message) return;
  window.clearTimeout(flashHint._t);
  flashHint._t = window.setTimeout(() => (node.textContent = ""), 2500);
}

