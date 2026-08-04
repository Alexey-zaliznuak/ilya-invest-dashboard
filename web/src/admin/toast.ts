const LIFETIME_MS = 4000;

let stack: HTMLElement | null = null;

const getStack = (): HTMLElement => {
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.append(stack);
  }
  return stack;
};

export function showToast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.role = 'status';
  toast.textContent = message;
  getStack().append(toast);
  setTimeout(() => toast.remove(), LIFETIME_MS);
}
