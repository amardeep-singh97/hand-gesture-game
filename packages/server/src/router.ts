import { router, publicProcedure, protectedProcedure } from './trpc';
import { db } from './db/index.js';
import { users, loginActivities, gameScore } from './db/schema.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { loginSchema, saveScoreSchema, signupSchema } from "@app/common/auth-schema";
import { TRPCError } from '@trpc/server';

export const appRouter = router({
    // login user

    login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(users).where(eq(users.email, input.email));
      
      if (!user || user.password !== input.password) {
        throw new Error("Invalid credentials");
      }

      const token = jwt.sign({ id: user.id, email: input.email }, 'my_super_secret_key', { expiresIn: '7d' });

      ctx.res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      await db.insert(loginActivities).values({
        userId: user.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Browser',
      });

      return { success: true, user: { id: user.id, email: user.email } };
    }),

    // check for login

    me: publicProcedure.query(({ ctx }) => {
    return Boolean(ctx.user) ?? false;
    }),

    // logout user

    logout: protectedProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie('token');
    return { success: true };
    }),

    // sign-up

signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ input }) => {
      const { email, password, name } = input;

      // Check if the user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        // Use CONFLICT code to tell the client this email is taken
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A user with this email already exists.',
        });
      }

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password,
          name: name,
        })
        .returning({ 
          id: users.id, 
          email: users.email 
        });

      await db.insert(gameScore).values({
        userId : newUser.id,
        score : "0"
      })

      return {
        success: true,
      };
    }),

    // get user score

    getHighScore : protectedProcedure.query(async ({ ctx }) => {

     const [scoreResult] =  await db.select().from(gameScore).where(eq(gameScore.userId, ctx.user.id));

     return {
      success : true,
      score : scoreResult?.score ?? 0
     }
      
    }),

    // save user score

    saveScore : protectedProcedure.input(saveScoreSchema).mutation(async ({ input, ctx }) => {

      const [result] = await db.select().from(gameScore).where(eq(gameScore.userId, ctx.user.id));

      if (input.score > Number(result.score)) {
          await db.update(gameScore).set({ score : String(input.score) }).where(eq(gameScore.userId, ctx.user.id));
          return { success : true };
      }

      return { success : false }
      
    })

});

export type AppRouter = typeof appRouter;