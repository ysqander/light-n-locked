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
import { cookies } from 'next/headers'
import { createCheckoutSession } from '@/lib/payments/stripe'
import { getUser, getUserWithTeam } from '@/lib/db/queries'
import { validatedAction, validatedActionWithUser } from '@/lib/auth/middleware'
import { lucia, validateRequest } from '@/lib/auth/lucia'
import { verify } from '@node-rs/argon2'
import { TimeSpan, createDate } from 'oslo'
import { sha256 } from 'oslo/crypto'
import { encodeHex } from 'oslo/encoding'
import { generateIdFromEntropySize } from 'lucia'
import { isWithinExpirationDate } from '@/lib/utils/dateUtils' // Ensure this import is present
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || '',
  }
  await db.insert(activityLogs).values(newActivity)
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
})

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data

  const userWithTeam = await db
    .select({
      user: users,
      team: teams,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.email, email))
    .limit(1)

  if (userWithTeam.length === 0) {
    return { error: 'Invalid email or password. Please try again.' }
  }

  const { user: foundUser, team: foundTeam } = userWithTeam[0]

  // const isPasswordValid = await comparePasswords(
  //   password,
  //   foundUser.passwordHash
  // )

  // login with pasword
  if (foundUser.passwordHash && password) {
    const isPasswordValid = await verify(foundUser.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    if (!isPasswordValid) {
      return { error: 'Invalid email or password. Please try again.' }
    } else {
      await Promise.all([
        //setSession(foundUser),
        logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN),
      ])

      try {
        const session = await lucia.createSession(foundUser.id, {})
        const sessionCookie = lucia.createSessionCookie(session.id)
        cookies().set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        )
      } catch (error) {
        return { error: 'Failed to create session. Please try signing in.' }
      }
    }
  }

  // login with github
  if (!foundUser.passwordHash && foundUser.githubId) {
    // TODO
    console.log('implment login with github')
  }

  const redirectTo = formData.get('redirect') as string | null
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string
    return createCheckoutSession({ team: foundTeam, priceId })
  }

  redirect('/dashboard')
})

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
})

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser.length > 0) {
    return { error: 'Failed to create user. Please try again.' }
  }

  //const passwordHash = await hashPassword(password);
  const passwordHash = await hashPasswordArgon2(password)

  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'owner', // Default role, will be overridden if there's an invitation
  }

  const [createdUser] = await db.insert(users).values(newUser).returning()

  if (!createdUser) {
    return { error: 'Failed to create user. Please try again.' }
  }

  let teamId: number
  let userRole: string
  let createdTeam: typeof teams.$inferSelect | null = null

  if (inviteId) {
    // Check if there's a valid invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1)

    if (invitation) {
      teamId = invitation.teamId
      userRole = invitation.role

      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, invitation.id))

      await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION)
      ;[createdTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)
    } else {
      return { error: 'Invalid or expired invitation.' }
    }
  } else {
    // Create a new team if there's no invitation
    const newTeam: NewTeam = {
      name: `${email}'s Team`,
    }

    ;[createdTeam] = await db.insert(teams).values(newTeam).returning()

    if (!createdTeam) {
      return { error: 'Failed to create team. Please try again.' }
    }

    teamId = createdTeam.id
    userRole = 'owner'

    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM)
  }

  const newTeamMember: NewTeamMember = {
    userId: createdUser.id,
    teamId: teamId,
    role: userRole,
  }

  try {
    await Promise.all([
      db.insert(teamMembers).values(newTeamMember),
      logActivity(teamId, createdUser.id, ActivityType.SIGN_UP),
      // setSession(createdUser), // replaced with Lucia auth flow
    ])
  } catch (error) {
    return { error: 'Failed to create team member. Please try signing in.' }
  }

  // Create Lucia auth session
  try {
    const session = await lucia.createSession(createdUser.id, {})
    const sessionCookie = lucia.createSessionCookie(session.id)
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    )
  } catch (error) {
    console.error('Failed to create session:', error)
    return { error: 'Failed to create session. Please try signing in.' }
  }

  const redirectTo = formData.get('redirect') as string | null
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string
    return createCheckoutSession({ team: createdTeam, priceId })
  }

  redirect('/dashboard')
})

export async function signOut() {
  // const user = (await getUser()) as User
  const { user, session } = await validateRequest()
  if (!user || !session) {
    return { error: 'Unauthorized' }
  }
  const userWithTeam = await getUserWithTeam(user.id)
  await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT)
  //cookies().delete('session')

  await lucia.invalidateSession(session.id)

  const sessionCookie = lucia.createBlankSessionCookie()
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  )
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

// export const updatePassword = validatedActionWithUser(
//   updatePasswordSchema,
//   async (data, _, user) => {
//     const { currentPassword, newPassword } = data

//     const isPasswordValid = await comparePasswords(
//       currentPassword,
//       user.passwordHash
//     )

//     if (!isPasswordValid) {
//       return { error: 'Current password is incorrect.' }
//     }

//     if (currentPassword === newPassword) {
//       return {
//         error: 'New password must be different from the current password.',
//       }
//     }

//     const newPasswordHash = await hashPassword(newPassword)
//     const userWithTeam = await getUserWithTeam(user.id)

//     await Promise.all([
//       db
//         .update(users)
//         .set({ passwordHash: newPasswordHash })
//         .where(eq(users.id, user.id)),
//       logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD),
//     ])

//     return { success: 'Password updated successfully.' }
//   }
// )

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100),
})

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, questUser) => {
    const { user, session } = await validateRequest()

    if (!user || !session) {
      return { error: 'Unauthorized' }
    }

    const { password } = data

    const result = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { passwordHash: true },
    })

    if (!result?.passwordHash) {
      return {
        error: 'Failed to retrieve password hash. Account deletion failed.',
      }
    }

    const isPasswordValid = await verify(result.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    if (!isPasswordValid) {
      return { error: 'Incorrect password. Account deletion failed.' }
    }

    const userWithTeam = await getUserWithTeam(user.id)

    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    )

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')`, // Ensure email uniqueness
      })
      .where(eq(users.id, user.id))

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

    // cookies().delete('session')
    await lucia.invalidateSession(session.id)
    redirect('/sign-in')
  }
)

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
})

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
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
    await db.insert(invitations).values({
      teamId: userWithTeam.teamId,
      email,
      role,
      invitedBy: user.id,
      status: 'pending',
    })

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    )

    // TODO: Send invitation email and include ?inviteId={id} to sign-up URL
    // await sendInvitationEmail(email, userWithTeam.team.name, role)

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
    const verificationLink = `${process.env.NEXT_PUBLIC_URL}/reset-password/${verificationToken}`

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
