export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`В разметке нет элемента ${selector}`);
  return element;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Тикеры и описания приходят из базы, поэтому перед вставкой в innerHTML их экранируем. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export function setText(selector: string, text: string): void {
  requireElement<HTMLElement>(selector).textContent = text;
}

export function toggleSignClass(selector: string, value: number): void {
  const element = requireElement<HTMLElement>(selector);
  element.classList.toggle('positive', value >= 0);
  element.classList.toggle('negative', value < 0);
}
