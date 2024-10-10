'use server'

import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/drizzle'
import {
  User,
  users,
  teams,
  teamMembers,
  activityLogs,
  passwordResetTokens,
  type NewUser,
  type NewTeam,
  type NewTeamMember,
  type NewActivityLog,
  ActivityType,
  invitations,
} from '@/lib/db/schema'
import {
  comparePasswords,
  hashPassword,
  hashPasswordArgon2,
  setSession,
} from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createCheckoutSession } from '@/lib/payments/stripe'
import { validatedAction, validatedActionWithUser } from '@/lib/auth/middleware'
import { lucia } from '@/lib/auth/lucia'
import { verify } from '@node-rs/argon2'
import { TimeSpan, createDate } from 'oslo'
import { sha256 } from 'oslo/crypto'
import { encodeHex } from 'oslo/encoding'
import { generateIdFromEntropySize } from 'lucia'
import { isWithinExpirationDate } from '@/lib/utils/dateUtils' // Ensure this import is present
import { Resend } from 'resend'
import { createUserAndTeam, getUserWithTeam } from '@/lib/db/data-access/users'
import { logActivity } from '@/lib/db/data-access/activity'
import { getUserWithTeamByEmail } from '@/lib/db/data-access/users'
import InvitationEmail from '@/components/InvitationEmail'
import { softDeleteUser } from '@/lib/db/data-access/users'
import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
  deleteSessionTokenCookie,
  invalidateSession,
  getCurrentSession,
} from '@/lib/auth/diy'
import { globalPOSTRateLimit } from '@/lib/server/request'
import { verifyEmailInput, checkEmailAvailability } from '@/lib/server/email'
import { verifyPasswordStrength } from '@/lib/server/password'
import { resend } from '@/lib/utils/resend'
import {
  createEmailVerificationRequest,
  sendVerificationEmail,
  setEmailVerificationRequestCookie,
} from '@/lib/server/email-verification'
import { SessionFlags } from '@/lib/auth/diy'
import { RefillingTokenBucket, Throttler } from '@/lib/server/rate-limit'
import { generateRandomRecoveryCode } from '@/lib/utils/codeGen'
import { encryptString } from '@/lib/server/encryption'

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
})

const throttler = new Throttler<number>([1, 2, 4, 8, 16, 30, 60, 180, 300])
const ipBucket = new RefillingTokenBucket<string>(20, 1)

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  if (!globalPOSTRateLimit) {
    return { error: 'Too many requests. Please try again later.' }
  }

  // TODO: Assumes X-Forwarded-For is always included.
  const clientIP = headers().get('X-Forwarded-For')
  if (clientIP !== null && !ipBucket.check(clientIP, 1)) {
    return {
      message: 'Too many requests',
    }
  }

  const { email, password } = data

  const userWithTeam = await getUserWithTeamByEmail(email)

  if (userWithTeam.length === 0) {
    return { error: 'Invalid email or password. Please try again or sign up.' }
  }

  const { user: foundUser, team: foundTeam } = userWithTeam[0]

  // Puts rate limits on sepcific user account
  if (clientIP !== null && !ipBucket.consume(clientIP, 1)) {
    return {
      error: 'Too many requests',
    }
  }
  if (!throttler.consume(foundUser.id)) {
    return {
      error: 'Too many requests',
    }
  }
  // login with pasword
  if (foundUser.passwordHash && password) {
    const isPasswordValid = await verify(foundUser.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    if (!isPasswordValid) {
      return {
        error: 'Invalid email or password. Please try again or sign up.',
      }
    } else {
      throttler.reset(foundUser.id)
      await Promise.all([
        //setSession(foundUser),
        logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN),
      ])

      try {
        const sessionFlags: SessionFlags = {
          twoFactorVerified: false,
        }

        const sessionToken = generateSessionToken()
        const session = await createSession(
          sessionToken,
          foundUser.id,
          sessionFlags
        )
        setSessionTokenCookie(sessionToken, session.expiresAt)
      } catch (error) {
        return { error: 'Failed to create session. Please try signing in.' }
      }
      if (!foundUser.emailVerified) {
        return redirect('/verify-email')
      }
      if (!foundUser.registered2FA) {
        return redirect('/2fa/setup')
      }
      return redirect('/2fa')
    }
  }

  const redirectTo = formData.get('redirect') as string | null
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string
    const checkoutUrl = await createCheckoutSession({
      team: foundTeam,
      priceId,
    })
    redirect(checkoutUrl)
  }

  redirect('/dashboard')
})

const signUpSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8),
  inviteId: z.string().optional(),
})

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  if (!globalPOSTRateLimit) {
    return { error: 'Too many requests. Please try again later.' }
  }

  const emailAvailable = await checkEmailAvailability(data.email)
  if (!emailAvailable) {
    return {
      error: 'Email is already used',
    }
  }

  const strongPassword = await verifyPasswordStrength(data.password)
  if (!strongPassword) {
    return {
      error: 'Weak password',
    }
  }

  const { email, password, inviteId } = data

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser.length > 0) {
    return { error: 'Failed to create user. Please try again.' }
  }

  const passwordHash = await hashPasswordArgon2(password)
  const recoveryCode = generateRandomRecoveryCode()
  const encryptedRecoveryCode = encryptString(recoveryCode)

  const newUser: NewUser = {
    email,
    passwordHash,
    recoveryCode: Buffer.from(encryptedRecoveryCode),
    role: 'owner', // Default role, will be overridden if there's an invitation
  }

  try {
    const { user: createdUser, team: createdTeam } = await createUserAndTeam(
      newUser,
      inviteId
    )

    // Create Lucia auth session
    // const session = await lucia.createSession(createdUser.id, {})

    // const sessionCookie = lucia.createSessionCookie(session.id)

    // cookies().set(
    //   sessionCookie.name,
    //   sessionCookie.value,
    //   sessionCookie.attributes
    // )
    if (!createdUser.email) {
      return { error: 'Failed to create user. Please try again.' }
    }

    const emailVerificationRequest = await createEmailVerificationRequest(
      createdUser.id,
      createdUser.email
    )
    if (!emailVerificationRequest) {
      return {
        error: 'Failed to create email verification request. Please try again.',
      }
    }
    sendVerificationEmail(
      emailVerificationRequest.email,
      emailVerificationRequest.code
    )
    setEmailVerificationRequestCookie(emailVerificationRequest)

    const sessionFlags: SessionFlags = {
      twoFactorVerified: false,
    }

    const sessionToken = generateSessionToken()
    const session = await createSession(
      sessionToken,
      createdUser.id,
      sessionFlags
    )
    setSessionTokenCookie(sessionToken, session.expiresAt)

    // TO DO adjust checkout in new email + password flow
    const redirectTo = formData.get('redirect') as string | null
    if (redirectTo === 'checkout') {
      const priceId = formData.get('priceId') as string
      return createCheckoutSession({ team: createdTeam, priceId })
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: 'Failed to create user and team. Please try again.' }
    }
  }

  redirect('/2fa/setup')
})

export async function signOut() {
  const { user, session } = await getCurrentSession()
  if (!user || !session) {
    return { error: 'Unauthorized' }
  }
  const userWithTeam = await getUserWithTeam(user.id)
  await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT)

  invalidateSession(session.id)
  deleteSessionTokenCookie()

  // Return a response instead of redirecting
  return { success: true }
}

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(100),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

const deleteAccountSchema = z.object({
  confirmText: z.string().refine((value) => value === 'CONFIRM DELETE', {
    message: "Please type 'CONFIRM DELETE' to proceed",
  }),
})

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, questUser) => {
    const { user, session } = await getCurrentSession()

    if (!user || !session) {
      return { error: 'Unauthorized' }
    }

    // Confirmation text is already validated by Zod schema

    const userWithTeam = await getUserWithTeam(user.id)

    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    )

    // Soft delete
    await softDeleteUser(user.id)

    if (userWithTeam?.teamId) {
      await db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, user.id),
            eq(teamMembers.teamId, userWithTeam.teamId)
          )
        )
    }

    // await lucia.invalidateSession(session.id)
    // const sessionCookie = lucia.createBlankSessionCookie()
    // cookies().set(
    //   sessionCookie.name,
    //   sessionCookie.value,
    //   sessionCookie.attributes
    // )

    invalidateSession(session.id)
    deleteSessionTokenCookie()
    return { success: 'Account deleted successfully.' }
  }
)

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
})

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { user: userOfSession, session } = await getCurrentSession()

    if (!userOfSession || !session) {
      return { error: 'Unauthorized' }
    }

    const { name, email } = data
    const userWithTeam = await getUserWithTeam(user.id)

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT),
    ])

    return { success: 'Account updated successfully.' }
  }
)

const removeTeamMemberSchema = z.object({
  memberId: z.number(),
})

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { user: userOfSession, session } = await getCurrentSession()

    if (!userOfSession || !session) {
      return { error: 'Unauthorized' }
    }

    const { memberId } = data
    const userWithTeam = await getUserWithTeam(user.id)

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' }
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    )

    return { success: 'Team member removed successfully' }
  }
)

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner']),
})

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { user: userOfSession, session } = await getCurrentSession()

    if (!userOfSession || !session) {
      return { error: 'Unauthorized' }
    }

    const { email, role } = data
    const userWithTeam = await getUserWithTeam(user.id)

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' }
    }

    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .where(
        and(eq(users.email, email), eq(teamMembers.teamId, userWithTeam.teamId))
      )
      .limit(1)

    if (existingMember.length > 0) {
      return { error: 'User is already a member of this team' }
    }

    // Check if there's an existing invitation
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1)

    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' }
    }

    // Create a new invitation
    const [invitation] = await db
      .insert(invitations)
      .values({
        teamId: userWithTeam.teamId,
        email,
        role,
        invitedBy: user.id,
        status: 'pending',
      })
      .returning()

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    )

    // Send invitation email
    const inviteUrl = `${process.env.BASE_URL}/sign-up?inviteId=${invitation.id}`

    try {
      await resend.emails.send({
        from: 'noreply@nexusscholar.org',
        to: email,
        subject: `You've been invited to join ${userWithTeam.teamName}`,
        react: InvitationEmail({
          inviteUrl,
          teamName: userWithTeam.teamName || '',
          inviterName: user.name || 'A team member',
        }) as React.ReactElement,
      })
    } catch (error) {
      console.error('Failed to send invitation email:', error)
      return {
        error: 'Invitation created but failed to send email. Please try again.',
      }
    }

    return { success: 'Invitation sent successfully' }
  }
)

// Function to create a password reset token
async function createPasswordResetToken(userId: number): Promise<string> {
  //Invalidate existing tokens
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId))
    .execute()

  const tokenId = generateIdFromEntropySize(25) // 40 characters
  const tokenHash = encodeHex(await sha256(new TextEncoder().encode(tokenId)))
  const expiresAt = createDate(new TimeSpan(2, 'h'))

  await db
    .insert(passwordResetTokens)
    .values({
      tokenHash,
      userId,
      expiresAt,
    })
    .execute()

  return tokenId
}

// Action to request a password reset
export const requestPasswordReset = validatedAction(
  z.object({
    email: z.string().email(),
  }),
  async (data) => {
    const { email } = data

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .execute()

    if (user.length === 0) {
      // respond with a generic message to avoid email enumeration
      return { success: 'If the email is valid, a reset link has been sent.' }
    }

    const userId = user[0].id
    const verificationToken = await createPasswordResetToken(userId)
    const verificationLink = `${process.env.BASE_URL}/reset-pass-old/${verificationToken}`

    await sendPasswordResetToken(email, verificationLink)

    return { success: 'If the email is valid, a reset link has been sent.' }
  }
)
async function sendPasswordResetToken(email: string, verificationLink: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'noreply@nexusscholar.org',
      to: email,
      subject: 'Password Reset Request',
      react: `<p>Click <a href="${verificationLink}">here</a> to reset your password.</p>`,
    })

    if (error) {
      return { error: 'Failed to send password reset email' }
    }

    return { success: 'Password reset email sent' }
  } catch (error) {
    return { error: 'Failed to send password reset email' }
  }
}
