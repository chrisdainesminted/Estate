import { useCallback, useEffect, useState } from 'react';

const KEY = 'dscr-theme';

function initial() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function useTheme() {
  const [dark, setDark] = useState(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Follow the host viewer's theme choice whenever it changes.
  useEffect(() => {
    const root = document.documentElement;
    const follow = () => {
      const t = root.getAttribute('data-theme');
      if (t === 'dark' || t === 'light') setDark(t === 'dark');
    };
    const mo = new MutationObserver(follow);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  // Follow the OS setting until the user picks a theme explicitly.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      try {
        if (!localStorage.getItem(KEY)) setDark(e.matches);
      } catch {
        setDark(e.matches);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
