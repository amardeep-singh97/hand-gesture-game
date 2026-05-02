import { pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Hash this in production!
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const loginActivities = pgTable('login_activities', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const gameScore = pgTable("game_score", {
  id : serial('id').primaryKey(),
  userId : uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  score : text("score")
})