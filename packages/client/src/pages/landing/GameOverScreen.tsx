import { RefObject, useEffect } from 'react';
import styles from './HandTrackingExperience.module.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appTrpc } from '@/trpc';

interface GameOverScreenProps {
  visible : boolean;
  score : number
  onRestart : () => void;
}

export default function GameOverScreen({ visible, score, onRestart } : GameOverScreenProps) {

  const queryClient = useQueryClient();
  const saveScore = useMutation(appTrpc.saveScore.mutationOptions({ onSuccess : (response) => {
    if (response.success) {
        queryClient.invalidateQueries({ queryKey : appTrpc.getHighScore.queryKey()})
    }
  }}));

  useEffect(() => {
    if (visible) {
      saveScore.mutate({
        score
      })
    }

  }, [visible])

  if (!visible) return null;

  return (
    <div className={styles.fnGameOver}>
      <h2>GAME OVER</h2>
      <p>Score: <strong>{score}</strong></p>
      <button type="button" className={styles.fnBtn} onClick={onRestart}>
        Play again
      </button>
    </div>
  );
}
