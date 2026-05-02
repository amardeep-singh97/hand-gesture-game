// @ts-ignore
import styles from './HandTrackingExperience.module.css';

interface ThemeSwitcherProps {
  visible : boolean;
  current : any;
  onChange : (props : any) => void;
}

const THEMES = [
  { id: 'Rainbow', label: 'Rainbow' },
  { id: 'FruitNinja', label: 'Fruit Ninja' },
];

export default function ThemeSwitcher({ visible, current, onChange } : ThemeSwitcherProps) {
  return (
    <div className={`${styles.themes} ${visible ? '' : styles.hidden}`}>
      {THEMES.map(t => (
        <button
          key={t.id}
          type="button"
          className={`${styles.themeBtn} ${current === t.id ? styles.active : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
