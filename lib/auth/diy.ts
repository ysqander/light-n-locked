import { sha256 } from '@oslojs/crypto/sha2'
import {
  User,
  LimitedUser,
  Session,
  sessions,
  users,
  usersWithDerived,
} from '@/lib/db/schema'
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from '@oslojs/encoding'
import { db } from '@/lib/db/drizzle'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { GitHub } from 'arctic'
import { SESSION_EXPIRY_DAYS_test } from '@/middleware'

// export const SESSION_EXPIRY_DAYS = 10
const SESSION_TOKEN_EXPIRY = 1000 * 60 * 60 * 24 * SESSION_EXPIRY_DAYS_test // 10 days

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return encodeBase32LowerCaseNoPadding(bytes)
}

export async function createSession(
  token: string,
  userId: number,
  flags: SessionFlags
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TOKEN_EXPIRY),
    twoFactorVerified: flags.twoFactorVerified,
    oAuth2Verified: flags.oAuth2Verified,
  }
  await db.insert(sessions).values(session)
  return session
}

export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
  const result = await db
    .select({
      user: usersWithDerived,
      session: sessions,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  if (result.length < 1) {
    return { session: null, user: null }
  }

  const { user, session } = result[0]
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, session.id))
    return { session: null, user: null }
  }

  if (Date.now() >= session.expiresAt.getTime() - SESSION_TOKEN_EXPIRY / 2) {
    session.expiresAt = new Date(Date.now() + SESSION_TOKEN_EXPIRY)
    await db
      .update(sessions)
      .set({ expiresAt: session.expiresAt })
      .where(eq(sessions.id, session.id))
  }

  return {
    session,
    user,
  }
}

export const getCurrentSession = cache(
  async (): Promise<SessionValidationResult> => {
    const token = cookies().get('session')?.value ?? null
    if (token === null) {
      return {
        session: null,
        user: null,
      }
    }
    const result = await validateSessionToken(token)
    return result
  }
)

//Function to get the current session with a limited user object on the clinet side (app/Layout and auth/index)
export const getCurrentSessionLimitedUser = cache(
  async (): Promise<SessionValidationResultLimitedUser> => {
    const token = cookies().get('session')?.value ?? null
    if (token === null) {
      return {
        session: null,
        user: null,
      }
    }
    const result = await validateSessionToken(token)
    if (result.user) {
      return {
        session: result.session,
        user: {
          id: result.user.id,
          name: result.user.name,
          role: result.user.role,
        },
      }
    }
    return result
  }
)

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export async function invalidateUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

export async function setSessionAs2FAVerified(
  sessionId: string
): Promise<void> {
  await db
    .update(sessions)
    .set({ twoFactorVerified: true })
    .where(eq(sessions.id, sessionId))
}

export function setSessionTokenCookie(token: string, expiresAt: Date): void {
  cookies().set('session', token, {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  })
}

export function deleteSessionTokenCookie(): void {
  cookies().set('session', '', {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  })
}

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID ?? '',
  process.env.GITHUB_CLIENT_SECRET ?? ''
)

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null }

export type SessionValidationResultLimitedUser =
  | { session: Session; user: LimitedUser }
  | { session: null; user: null }

export interface SessionFlags {
  twoFactorVerified: boolean
  oAuth2Verified: boolean
}
