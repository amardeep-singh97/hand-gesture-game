import { initTRPC, TRPCError } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'my_super_secret_key';

export const authTrpcContext = ({ req, res }: trpcExpress.CreateExpressContextOptions) => {
  const token = req.cookies?.token;
  let user = null;

  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    } catch (e) {
      console.log("INVALID TOKEN")
      // Token invalid or expired
    }
  }

  return { req, res, user };
};

const t = initTRPC.context<typeof authTrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) { // If user is not authenticated then throw error
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});