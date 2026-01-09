import { useEffect } from 'react';

export function usePreferredTheme() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (isDark: boolean) => {
      const root = document.documentElement;
      root.dataset.theme = isDark ? 'dark' : 'light';
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };
    apply(media.matches);
    const handler = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);
}
