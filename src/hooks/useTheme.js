import { useCallback, useEffect, useState } from 'react';

const KEY = 'dscr-theme';

// index.html sets the class before paint: onyx (dark) unless the person picked light.
function initial() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

export function useTheme() {
  const [dark, setDark] = useState(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // The toggle is the only switch, and it's remembered in this browser.
  const toggle = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem(KEY, d ? 'light' : 'dark');
      } catch {
        // ignore
      }
      return !d;
    });
  }, []);

  return { dark, toggle };
}
