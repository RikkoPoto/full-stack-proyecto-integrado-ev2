import { useTheme } from '../../context/ThemeProvider.jsx';
import Icon from '../ui/Icon.jsx';

const OPTIONS = [
  { value: 'system', label: 'Automático', icon: 'monitor' },
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Oscuro', icon: 'moon' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema de color" className="flex items-center rounded-md border border-line bg-surface p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setTheme(o.value)}
          className={`rounded p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${theme === o.value ? 'bg-accent-soft text-accent' : 'text-mute hover:text-ink'}`}
        >
          <Icon name={o.icon} className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
