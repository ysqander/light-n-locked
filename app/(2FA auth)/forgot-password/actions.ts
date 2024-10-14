'use server'

import { verifyEmailInput } from '@/lib/server/email'
import {
  createPasswordResetSession,
  invalidateUserPasswordResetSessions,
  sendPasswordResetEmail,
  setPasswordResetSessionTokenCookie,
} from '@/lib/server/password-reset'
import { RefillingTokenBucket } from '@/lib/server/rate-limit'
import { globalPOSTRateLimit } from '@/lib/server/request'
import { generateSessionToken } from '@/lib/auth/diy'
import { getUserByEmail } from '@/lib/db/data-access/users'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { validatedAction } from '@/lib/auth/middleware'
import { z } from 'zod'

const passwordResetEmailIPBucket = new RefillingTokenBucket<string>(3, 60)
const passwordResetEmailUserBucket = new RefillingTokenBucket<number>(3, 60)

export const forgotPasswordAction = validatedAction(
  z.object({
    email: z.string().email(),
  }),
  async (data) => {
    if (!globalPOSTRateLimit()) {
      return {
        message: 'Too many requests',
      }
    }
    // TODO: Assumes X-Forwarded-For is always included.
    const clientIP = headers().get('X-Forwarded-For')
    if (clientIP !== null && !passwordResetEmailIPBucket.check(clientIP, 1)) {
      return {
        message: 'Too many requests',
      }
    }

    const email = data.email
    if (typeof email !== 'string') {
      return {
        error: 'Invalid or missing fields',
      }
    }
    if (!verifyEmailInput(email)) {
      return {
        error: 'Invalid email',
      }
    }
    const user = await getUserByEmail(email)
    if (user === null || user.email === null) {
      return {
        error: 'Account does not exist',
      }
    }
    if (clientIP !== null && !passwordResetEmailIPBucket.consume(clientIP, 1)) {
      return {
        error: 'Too many requests',
      }
    }
    if (!passwordResetEmailUserBucket.consume(user.id, 1)) {
      return {
        error: 'Too many requests',
      }
    }
    invalidateUserPasswordResetSessions(user.id)
    const sessionToken = generateSessionToken()
    const session = await createPasswordResetSession(
      sessionToken,
      user.id,
      user.email
    )

    sendPasswordResetEmail(user.email, session.code)
    setPasswordResetSessionTokenCookie(sessionToken, session.expiresAt)
    return {
      success: 'Email sent',
    }
  }
)
