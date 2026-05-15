import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash'),
  email_verified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  session_token: text('session_token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
})
