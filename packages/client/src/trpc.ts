import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext, createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from '../../server/src/router.js'; // Direct type import
import { appQueryClient } from './tanstack-query.js';

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3001/trpc-api', fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },})],
});
 
export const appTrpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient : appQueryClient,
});
