'use server'

import {
  createEmailVerificationRequest,
  deleteEmailVerificationRequestCookie,
  deleteUserEmailVerificationRequest,
  getUserEmailVerificationRequestFromRequest,
  sendVerificationEmail,
  sendVerificationEmailBucket,
  setEmailVerificationRequestCookie,
} from '@/lib/server/email-verification'
import { invalidateUserPasswordResetSessions } from '@/lib/server/password-reset'
import { ExpiringTokenBucket } from '@/lib/server/rate-limit'
import { globalPOSTRateLimit } from '@/lib/server/request'
import { getCurrentSession } from '@/lib/auth/diy'
import { updateUserEmailAndSetEmailAsVerified } from '@/lib/db/data-access/users'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { validatedAction } from '@/lib/auth/middleware'

const bucket = new ExpiringTokenBucket<number>(5, 60 * 30)

const verifyEmailSchema = z.object({
  code: z.string(),
})

export const verifyEmailAction = validatedAction(
  verifyEmailSchema,
  async (data, _) => {
    if (!globalPOSTRateLimit()) {
      return {
        error: 'Too many requests',
      }
    }

    const { session, user } = await getCurrentSession()
    if (session === null) {
      return {
        error: 'Not authenticated',
      }
    }
    if (user.registered2FA && !session.twoFactorVerified) {
      return {
        error: 'Forbidden',
      }
    }
    if (!bucket.check(user.id, 1)) {
      return {
        error: 'Too many requests',
      }
    }

    const verificationRequest =
      await getUserEmailVerificationRequestFromRequest()

    if (verificationRequest === null) {
      return {
        error: 'Not authenticated',
      }
    }
    const code = data.code
    if (typeof code !== 'string') {
      return {
        error: 'Invalid or missing fields',
      }
    }
    if (code === '') {
      return {
        error: 'Enter your code',
      }
    }
    if (!bucket.consume(user.id, 1)) {
      return {
        error: 'Too many requests',
      }
    }
    if (Date.now() >= verificationRequest.expiresAt.getTime()) {
      const newVerificationRequest = await createEmailVerificationRequest(
        verificationRequest.userId,
        verificationRequest.email
      )
      sendVerificationEmail(
        newVerificationRequest.email,
        newVerificationRequest.code
      )
      setEmailVerificationRequestCookie(newVerificationRequest)
      return {
        error:
          'The verification code was expired. We sent another code to your inbox.',
      }
    }
    if (verificationRequest.code !== code) {
      return {
        error: 'Incorrect code.',
      }
    }
    await deleteUserEmailVerificationRequest(user.id)
    await invalidateUserPasswordResetSessions(user.id)
    await updateUserEmailAndSetEmailAsVerified(
      user.id,
      verificationRequest.email
    )
    deleteEmailVerificationRequestCookie()
    if (!user.registered2FA) {
      return redirect('/2fa/setup')
    }
    return redirect('/')
  }
)

export async function resendEmailVerificationCodeAction(): Promise<ActionResult> {
  const { session, user } = await getCurrentSession()

  if (session === null) {
    return {
      error: 'Not authenticated',
    }
  }
  if ((user.registered2FA && !session.twoFactorVerified) || !user.email) {
    return {
      error: 'Forbidden',
    }
  }
  if (!sendVerificationEmailBucket.check(user.id, 1)) {
    return {
      error: 'Too many requests',
    }
  }

  const verificationRequest = await getUserEmailVerificationRequestFromRequest()
  let newVerificationRequest

  if (verificationRequest === null) {
    if (user.emailVerified) {
      return {
        error: 'Forbidden',
      }
    }
    if (!sendVerificationEmailBucket.consume(user.id, 1)) {
      return {
        error: 'Too many requests',
      }
    }
    newVerificationRequest = await createEmailVerificationRequest(
      user.id,
      user.email
    )
  } else {
    if (!sendVerificationEmailBucket.consume(user.id, 1)) {
      return {
        error: 'Too many requests',
      }
    }
    newVerificationRequest = await createEmailVerificationRequest(
      user.id,
      verificationRequest.email
    )
  }

  await sendVerificationEmail(
    newVerificationRequest.email,
    newVerificationRequest.code
  )
  setEmailVerificationRequestCookie(newVerificationRequest)
  return {
    success: 'A new code was sent to your inbox.',
  }
}

type ActionResult = {
  error?: string
  success?: string
}
