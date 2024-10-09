'use server'

import { sha256 } from 'oslo/crypto'
import { z } from 'zod'
import { validatedAction } from '@/lib/auth/middleware'
import { db } from '@/lib/db/drizzle'
import { passwordResetTokens, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encodeHex } from 'oslo/encoding'
import { isWithinExpirationDate } from '@/lib/utils/dateUtils'
import { hashPasswordArgon2 } from '@/lib/auth/session'
import { lucia } from '@/lib/auth/lucia'
import { cookies } from 'next/headers'
import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
  getCurrentSession,
  invalidateSession,
  deleteSessionTokenCookie,
} from '@/lib/auth/diy'
import { globalPOSTRateLimit } from '@/lib/server/request'

export const resetPassword = validatedAction(
  z.object({
    password: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
    token: z.string(), // Include token in the validation schema
  }),
  // .refine((data) => data.password === data.confirmPassword, {
  //   message: "Passwords don't match",
  //   path: ['confirmPassword'],
  // }),
  async (data) => {
    if (!globalPOSTRateLimit()) {
      return { error: 'Too many requests' }
    }

    // Check if passwords match
    if (data.password !== data.confirmPassword) {
      return { error: "Passwords don't match" }
    }

    const { user, session } = await getCurrentSession()
    if (!user) {
      return { error: 'Unauthorized' }
    }

    const { password, token } = data // Extract token from form data

    const tokenHash = encodeHex(await sha256(new TextEncoder().encode(token)))
    const tokenRecord = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1)
      .execute()

    if (tokenRecord.length === 0) {
      return { error: 'unauthorized' }
    }

    const { userId, expiresAt } = tokenRecord[0]

    if (!isWithinExpirationDate(expiresAt)) {
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .execute()
      return { error: 'unauthorized' }
    }

    const newPasswordHash = await hashPasswordArgon2(password)

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, userId))
        .execute(),

      db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .execute(),
    ])

    //lucia.invalidateUserSessions(userId),

    invalidateSession(session.id)
    deleteSessionTokenCookie()

    // const session = await lucia.createSession(userId, {})
    // const sessionCookie = lucia.createSessionCookie(session.id)
    // cookies().set(
    //   sessionCookie.name,
    //   sessionCookie.value,
    //   sessionCookie.attributes
    // )

    const sessionToken = generateSessionToken()
    const newSession = await createSession(sessionToken, userId)
    setSessionTokenCookie(sessionToken, newSession.expiresAt)

    //Referrer-Policy set to 'strict-origin' in the head of the page
    return { success: 'Password reset successful.' }
  }
)