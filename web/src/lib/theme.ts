const STORAGE_KEY = 'roe-theme';

export type Theme = 'dark' | 'light';

const labels: Record<Theme, string> = {
  dark: 'Включить светлую тему',
  light: 'Включить тёмную тему',
};

const icons: Record<Theme, string> = {
  // В тёмной теме кнопка предлагает перейти на светлую — солнце
  dark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  // В светлой — луна
  light: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/></svg>`,
};

const readStored = (): Theme => (localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark');

function apply(theme: Theme, toggle: HTMLElement | null): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  if (toggle) {
    toggle.innerHTML = icons[theme];
    toggle.setAttribute('aria-label', labels[theme]);
    toggle.setAttribute('title', labels[theme]);
  }
}

/** @param onChange вызывается после переключения — графику нужно перерисоваться под новые цвета. */
export function initTheme(toggle: HTMLElement | null, onChange?: () => void): void {
  apply(readStored(), toggle);

  toggle?.addEventListener('click', () => {
    apply(readStored() === 'light' ? 'dark' : 'light', toggle);
    onChange?.();
  });
}
