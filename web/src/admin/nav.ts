import { requireElement } from '../lib/dom';

export type AdminSection = 'trades' | 'telegram';

const TITLES: Record<AdminSection, string> = {
  trades: 'Сделки: добавление и список',
  telegram: 'Telegram: автосбор и лог',
};

const isSection = (value: string): value is AdminSection =>
  value === 'trades' || value === 'telegram';

export function bindAdminNav(): { show(section: AdminSection): void } {
  const subtitle = requireElement<HTMLElement>('#topbarSubtitle');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-nav-item'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-section-panel]'));

  const show = (section: AdminSection): void => {
    for (const button of buttons) {
      button.classList.toggle('is-active', button.dataset.section === section);
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.sectionPanel !== section;
    }
    subtitle.textContent = TITLES[section];
    const hash = `#${section}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      if (section && isSection(section)) show(section);
    });
  }

  window.addEventListener('hashchange', () => {
    const raw = window.location.hash.replace(/^#/, '');
    if (isSection(raw)) show(raw);
  });

  const initial = window.location.hash.replace(/^#/, '');
  show(isSection(initial) ? initial : 'trades');

  return { show };
}
