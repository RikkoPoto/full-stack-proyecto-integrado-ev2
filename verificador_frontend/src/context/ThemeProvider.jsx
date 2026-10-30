import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'verificador.theme';
const ThemeContext = createContext(null);

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const el = document.documentElement;
    // Cambio de tema instantáneo: se desactivan las transiciones de color por un instante.
    el.classList.add('theme-switching');
    const t = setTimeout(() => el.classList.remove('theme-switching'), 80);
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* sin almacenamiento */
    }
    return () => clearTimeout(t);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
