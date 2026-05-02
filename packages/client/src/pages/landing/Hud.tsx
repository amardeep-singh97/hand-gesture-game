// @ts-ignore
import styles from './HandTrackingExperience.module.css';

import { useQuery } from '@tanstack/react-query';
import { appTrpc } from '@/trpc';

/**
 * Heads-up display panels.
 * Driven by refs (not state) because the canvas render loop updates these
 * many times per second; using state would re-render React on every frame.
 * The parent assigns the inner <span> nodes to refs and writes to .textContent.
 */
export default function Hud({
  visible,
  ninjaMode,
  handsRef,
  fpsRef,
  gestureRef,
  spreadRef,
  scoreRef,
  livesRef,
} :  any) {

  const highScore = useQuery(appTrpc.getHighScore.queryOptions())

  return (
    <div className={`${styles.hud} ${visible ? '' : styles.hidden}`}>
      <div className={styles.panel}>
        <div className={styles.stat}>
          <span>Hands Detected:</span>
          <span className={styles.statVal} ref={handsRef}>0</span>
        </div>
        <div className={styles.stat}>
          <span>FPS:</span>
          <span className={styles.statVal} ref={fpsRef}>0</span>
        </div>
      </div>

      <div className={`${styles.panel} ${ninjaMode ? styles.subpanelHidden : ''}`}>
        <div className={styles.stat}>
          <span>Gesture:</span>
          <span className={styles.statVal} ref={gestureRef}>None</span>
        </div>
        <div className={styles.stat}>
          <span>Spread:</span>
          <span className={styles.statVal} ref={spreadRef}>0%</span>
        </div>
      </div>

      <div className={`${styles.panel} ${ninjaMode ? '' : styles.subpanelHidden}`}>
        {
          highScore.isFetched && 
          <div className={styles.stat}>
          <span>Your High Score:</span>
          <span className={styles.statVal}>{highScore.data?.score ?? 0}</span>
        </div>
        }
        <div className={styles.stat}>
          <span>Score:</span>
          <span className={styles.statVal} ref={scoreRef}>0</span>
        </div>
        <div className={styles.stat}>
          <span>Lives:</span>
          <span className={styles.statLives} ref={livesRef}>3</span>
        </div>
      </div>
    </div>
  );
}
