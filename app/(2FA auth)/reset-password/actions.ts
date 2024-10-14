'use server'

import { z } from 'zod'
import { validatedAction } from '@/lib/auth/middleware'
import { verifyPasswordStrength } from '@/lib/server/password'
import {
  validatePasswordResetSessionRequest,
  invalidateUserPasswordResetSessions,
} from '@/lib/server/password-reset'
import {
  createSession,
  generateSessionToken,
  invalidateUserSessions,
  setSessionTokenCookie,
} from '@/lib/auth/diy'
import { updateUserPassword } from '@/lib/server/user'
import { globalPOSTRateLimit } from '@/lib/server/request'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const resetPasswordAction = validatedAction(
  resetPasswordSchema,
  async (data) => {
    if (!globalPOSTRateLimit()) {
      return {
        error: 'Too many requests',
      }
    }

    const { session: passwordResetSession, user } =
      await validatePasswordResetSessionRequest()
    if (passwordResetSession === null) {
      return {
        error: 'Not authenticated',
      }
    }
    if (!passwordResetSession.emailVerified) {
      return {
        error: 'Forbidden',
      }
    }
    if (user.registered2FA && !passwordResetSession.twoFactorVerified) {
      return {
        error: 'Forbidden',
      }
    }

    const { password } = data

    const strongPassword = await verifyPasswordStrength(password)
    if (!strongPassword) {
      return {
        error: 'Weak password',
      }
    }

    invalidateUserPasswordResetSessions(passwordResetSession.userId)
    invalidateUserSessions(passwordResetSession.userId)
    await updateUserPassword(passwordResetSession.userId, password)

    const sessionFlags = {
      twoFactorVerified: passwordResetSession.twoFactorVerified,
      oAuth2Verified: false,
    }
    const sessionToken = generateSessionToken()
    const session = await createSession(
      sessionToken,
      passwordResetSession.userId,
      sessionFlags
    )
    setSessionTokenCookie(sessionToken, session.expiresAt)

    return { success: 'Password reset successful' }
  }
)
