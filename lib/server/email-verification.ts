import { generateRandomOTP } from '@/lib/utils/codeGen'
import { db } from '@/lib/db/drizzle'
import { ExpiringTokenBucket } from '@/lib/server/rate-limit'
import { encodeBase32 } from '@oslojs/encoding'
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { getCurrentSession } from '@/lib/auth/diy'
import { emailVerificationRequests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { emailDomain, resend } from '@/lib/utils/resend'
import { ConfirmationEmail } from '@/components/ConfirmationEmail'

export async function getUserEmailVerificationRequest(
  userId: number,
  id: string
): Promise<EmailVerificationRequest | null> {
  const row = await db
    .select()
    .from(emailVerificationRequests)
    .where(
      and(
        eq(emailVerificationRequests.id, id),
        eq(emailVerificationRequests.userId, userId)
      )
    )
    .execute()
    .then((result) => result[0])
  if (row === null) {
    return row
  }
  const request: EmailVerificationRequest = {
    id: row.id,
    userId: row.userId,
    code: row.code,
    email: row.email,
    expiresAt: new Date(row.expiresAt.getTime() * 1000),
  }
  return request
}

export async function createEmailVerificationRequest(
  userId: number,
  email: string
): Promise<EmailVerificationRequest> {
  deleteUserEmailVerificationRequest(userId)
  const idBytes = new Uint8Array(20)
  crypto.getRandomValues(idBytes)
  const id = encodeBase32(idBytes).toLowerCase()

  const code = generateRandomOTP()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10)
  const insertedRequest = await db
    .insert(emailVerificationRequests)
    .values({
      id: id,
      userId: userId,
      code: code,
      email: email,
      expiresAt: expiresAt,
    })
    .returning({ insertedId: emailVerificationRequests.id })
    .execute()

  const request: EmailVerificationRequest = {
    id,
    userId,
    code,
    email,
    expiresAt,
  }
  return request
}

export async function deleteUserEmailVerificationRequest(
  userId: number
): Promise<void> {
  await db
    .delete(emailVerificationRequests)
    .where(eq(emailVerificationRequests.userId, userId))
    .execute()
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  try {
    const userName = email.split('@')[0] // Simple way to get a username, you might want to adjust this

    await resend.emails.send({
      from: `Verification <noreply@${emailDomain}>`,
      to: email,
      subject: 'Verify your email address',
      react: ConfirmationEmail({
        verificationCode: code,
        userName,
      }) as React.ReactElement,
    })
  } catch (error) {
    console.error('Error sending verification email:', error)
    throw new Error('Failed to send verification email')
  }
}

export function setEmailVerificationRequestCookie(
  request: EmailVerificationRequest
): void {
  (cookies() as unknown as UnsafeUnwrappedCookies).set('email_verification', request.id, {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: request.expiresAt,
  })
}

export function deleteEmailVerificationRequestCookie(): void {
  (cookies() as unknown as UnsafeUnwrappedCookies).set('email_verification', '', {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  })
}

export async function getUserEmailVerificationRequestFromRequest(): Promise<EmailVerificationRequest | null> {
  const { user } = await getCurrentSession()
  if (user === null) {
    return null
  }
  const id = (await cookies()).get('email_verification')?.value ?? null
  if (id === null) {
    return null
  }
  const request = getUserEmailVerificationRequest(user.id, id)
  if (request === null) {
    deleteEmailVerificationRequestCookie()
  }
  return request
}

export const sendVerificationEmailBucket = new ExpiringTokenBucket<number>(
  3,
  60 * 10
)

export interface EmailVerificationRequest {
  id: string
  userId: number
  code: string
  email: string
  expiresAt: Date
}
