export function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

export function flashHint(node, message) {
  node.textContent = message;
  if (!message) return;
  window.clearTimeout(flashHint._t);
  flashHint._t = window.setTimeout(() => (node.textContent = ""), 2500);
}

