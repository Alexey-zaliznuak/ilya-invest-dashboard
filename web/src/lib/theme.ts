const STORAGE_KEY = 'roe-theme';

export type Theme = 'dark' | 'light';

const labels: Record<Theme, string> = {
  dark: 'Светлая тема',
  light: 'Тёмная тема',
};

const readStored = (): Theme => (localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark');

function apply(theme: Theme, toggle: HTMLElement | null): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  if (toggle) toggle.textContent = labels[theme];
}

/** @param onChange вызывается после переключения — графику нужно перерисоваться под новые цвета. */
export function initTheme(toggle: HTMLElement | null, onChange?: () => void): void {
  apply(readStored(), toggle);

  toggle?.addEventListener('click', () => {
    apply(readStored() === 'light' ? 'dark' : 'light', toggle);
    onChange?.();
  });
}
