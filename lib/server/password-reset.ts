import { db } from '@/lib/db/drizzle'
import { encodeHexLowerCase } from '@oslojs/encoding'
import { generateRandomOTP } from '@/lib/utils/codeGen'
import { sha256 } from '@oslojs/crypto/sha2'
import { cookies } from 'next/headers'
import { passwordResetSessions, usersWithDerived, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { resend } from '@/lib/utils/resend'
import { PasswordResetEmail } from '@/components/PasswordResetEmail'
import type { User } from '@/lib/db/schema'

export async function createPasswordResetSession(
  token: string,
  userId: number,
  email: string
): Promise<PasswordResetSession> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
  const session: PasswordResetSession = {
    id: sessionId,
    userId,
    email,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    code: generateRandomOTP(),
    emailVerified: false,
    twoFactorVerified: false,
  }

  await db.insert(passwordResetSessions).values({ ...session })
  return session
}

export async function validatePasswordResetSessionToken(
  token: string
): Promise<PasswordResetSessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

  const result = await db
    .select({
      session: {
        id: passwordResetSessions.id,
        userId: passwordResetSessions.userId,
        email: passwordResetSessions.email,
        code: passwordResetSessions.code,
        expiresAt: passwordResetSessions.expiresAt,
        emailVerified: passwordResetSessions.emailVerified,
        twoFactorVerified: passwordResetSessions.twoFactorVerified,
      },
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
        registered2FA: usersWithDerived.registered2FA,
      },
    })
    .from(passwordResetSessions)
    .innerJoin(users, eq(passwordResetSessions.userId, users.id))
    .where(eq(passwordResetSessions.id, sessionId))
    .limit(1)
    .execute()

  if (result.length === 0) {
    return { session: null, user: null }
  }

  const { session, user } = result[0]

  if (Date.now() >= session.expiresAt.getTime()) {
    db.delete(passwordResetSessions)
      .where(eq(passwordResetSessions.id, session.id))
      .execute()
    return { session: null, user: null }
  }

  return {
    session,
    user: user as Partial<User>,
  }
}

export async function setPasswordResetSessionAsEmailVerified(
  sessionId: string
): Promise<void> {
  await db
    .update(passwordResetSessions)
    .set({ emailVerified: true })
    .where(eq(passwordResetSessions.id, sessionId))
    .execute()
}

export async function setPasswordResetSessionAs2FAVerified(
  sessionId: string
): Promise<void> {
  await db
    .update(passwordResetSessions)
    .set({ twoFactorVerified: true })
    .where(eq(passwordResetSessions.id, sessionId))
    .execute()
}

export async function invalidateUserPasswordResetSessions(
  userId: number
): Promise<void> {
  await db
    .delete(passwordResetSessions)
    .where(eq(passwordResetSessions.userId, userId))
    .execute()
}

export async function validatePasswordResetSessionRequest(): Promise<PasswordResetSessionValidationResult> {
  const token = cookies().get('password_reset_session')?.value ?? null
  if (token === null) {
    return { session: null, user: null }
  }
  const result = await validatePasswordResetSessionToken(token)
  if (result.session === null) {
    deletePasswordResetSessionTokenCookie()
  }
  return result
}

export function setPasswordResetSessionTokenCookie(
  token: string,
  expiresAt: Date
): void {
  cookies().set('password_reset_session', token, {
    expires: expiresAt,
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function deletePasswordResetSessionTokenCookie(): void {
  cookies().set('password_reset_session', '', {
    maxAge: 0,
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function sendPasswordResetEmail(email: string, code: string) {
  try {
    const userName = email.split('@')[0] // Simple way to get a username

    await resend.emails.send({
      from: 'Password Reset <noreply@nexusscholar.org>',
      to: email,
      subject: 'Reset your password',
      react: PasswordResetEmail({
        resetCode: code,
        userName,
      }) as React.ReactElement,
    })

    console.log(`Password reset email sent to ${email}`)
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw new Error('Failed to send password reset email')
  }
}

export interface PasswordResetSession {
  id: string
  userId: number
  email: string
  expiresAt: Date
  code: string
  emailVerified: boolean
  twoFactorVerified: boolean
}

export type PasswordResetSessionValidationResult =
  | { session: PasswordResetSession; user: Partial<User> }
  | { session: null; user: null }
