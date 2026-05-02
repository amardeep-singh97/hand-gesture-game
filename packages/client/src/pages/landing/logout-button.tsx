// @ts-ignore
import styles from './HandTrackingExperience.module.css';

import { useMutation } from '@tanstack/react-query';
import { appTrpc } from '@/trpc';
import { appPaths } from '@/routes/paths';
import { useCallback } from 'react';

export default function LogoutButton() {

    const logoutMutation = useMutation(appTrpc.logout.mutationOptions({ onSuccess : () => {
        window.location.href = appPaths.auth;
    }}))
    
    const handleLogout = useCallback(() => {
          logoutMutation.mutate();
    }, []);

    return  (<button
              onClick={handleLogout}
              className={styles.logoutBtn}
              title="Logout"
            >
              Logout
            </button>)
}