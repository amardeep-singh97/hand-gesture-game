// @ts-ignore
import styles from './HandTrackingExperience.module.css';

interface StartOverlayProps {
  visible : boolean;
  onStart : () => void;
}

export default function StartOverlay({ visible, onStart } : StartOverlayProps ) {
  return (
    <div className={`${styles.startOverlay} ${visible ? '' : styles.hidden}`}>
      <h1 className={styles.startTitle}>Welcome!!</h1>
      <p className={styles.startBlurb}>
        Grant camera permissions and click to start audio/visual experience
      </p>
      <button type="button" className={styles.startBtn} onClick={onStart}>
        Enter Experience
      </button>
    </div>
  );
}
