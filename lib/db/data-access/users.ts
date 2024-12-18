import { db } from '@/lib/db/drizzle'
import {
  users,
  teams,
  teamMembers,
  invitations,
  type NewUser,
  type NewTeam,
  type NewTeamMember,
  type User,
  usersWithDerived,
} from '@/lib/db/schema'
import { eq, and, or, isNotNull, like, sql, isNull } from 'drizzle-orm'
import { ActivityType } from '@/lib/db/schema'
import { logActivity } from '@/lib/db/data-access/activity'

// Define a type for the user attributes you want to return
type UserResponse = Omit<
  User,
  | 'deletedAt'
  | 'passwordHash'
  | 'githubId'
  | 'githubUsername'
  | 'totpKey'
  | 'recoveryCode'
  | 'role'
  | 'createdAt'
  | 'updatedAt'
  | 'deletionMethod'
> & {
  registered2FA: boolean
}

export async function createUserAndTeam(
  userData: Omit<NewUser, 'id'>,
  inviteId?: string
) {
  const [createdUser] = await db.insert(users).values(userData).returning()

  if (!createdUser) {
    throw new Error('Failed to create user')
  }

  let teamId: number
  let userRole: string
  let team: typeof teams.$inferSelect | null = null

  if (inviteId) {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, Number(inviteId)),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1)

    if (!invitation) {
      throw new Error('Invalid or expired invitation')
    }

    teamId = invitation.teamId
    userRole = invitation.role

    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id))
    ;[team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)

    if (!team) {
      throw new Error('Team not found')
    }

    await db.insert(teamMembers).values({
      userId: createdUser.id,
      teamId: teamId,
      role: userRole,
    })

    await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION)
  } else {
    const newTeam: NewTeam = {
      name: `${userData.email || userData.githubUsername}'s Team`,
    }

    ;[team] = await db.insert(teams).values(newTeam).returning()

    if (!team) {
      throw new Error('Failed to create team')
    }

    teamId = team.id
    userRole = 'owner'

    await db.insert(teamMembers).values({
      userId: createdUser.id,
      teamId: teamId,
      role: userRole,
    })

    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM)
  }

  await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP)

  return { user: createdUser, team }
}

export async function getUserWithTeamByEmail(email: string) {
  const result = await db
    .select({
      user: users,
      team: teams,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.email, email))
    .limit(1)

  return result
}

export async function getUserByEmail(
  email: string
): Promise<UserResponse | null> {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      registered2FA: usersWithDerived.registered2FA,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  return result[0]
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
      teamName: teams.name,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt))) // Add check for deletedAt
    .limit(1)

  return result[0]
}

export async function getUserWithTeamByGithubId(githubId: number) {
  const result = await db
    .select({
      user: users,
      team: teams,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.githubId, githubId))
    .limit(1)

  return result
}

export async function softDeleteUser(userId: number) {
  console.log('Soft deleting user:', userId)
  try {
    const result = await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        deletionMethod: 'soft_delete',
        email: sql`CASE 
          WHEN ${users.email} IS NOT NULL 
          THEN CONCAT('deleted_', ${users.id}::text, '_', ${users.email})
          ELSE ${users.email}
        END`,
        githubId: sql`CASE 
          WHEN ${users.githubId} IS NOT NULL 
          THEN CONCAT('deleted_', ${users.id}::text, '_', ${users.githubId}::text)::integer
          ELSE ${users.githubId}
        END`,
        githubUsername: sql`CASE 
          WHEN ${users.githubUsername} IS NOT NULL 
          THEN CONCAT('deleted_', ${users.id}::text, '_', ${users.githubUsername})
          ELSE ${users.githubUsername}
        END`,
      })
      .where(eq(users.id, userId))
      .returning()
    console.log('Soft delete result:', result)
    return result[0]
  } catch (error) {
    console.error('Error in softDeleteUser:', error)
    throw error
  }
}

export async function findSoftDeletedUser(identifier: string) {
  const user = await db
    .select()
    .from(users)
    .where(
      and(
        or(
          like(users.email, `deleted_%_${identifier}%`),
          like(users.githubUsername, `deleted_%_${identifier}%`),
          sql`${users.githubId}::text LIKE ${'deleted_%_' + identifier + '%'}`
        ),
        isNotNull(users.deletedAt)
      )
    )
    .limit(1)

  return user[0] || null
}

export async function restoreSoftDeletedUser(
  userId: number,
  newEmail?: string,
  newGithubId?: number,
  newGithubUsername?: string
) {
  await db
    .update(users)
    .set({
      deletedAt: null,
      email:
        newEmail || sql`SUBSTRING(${users.email} FROM '^deleted_[0-9]+_(.*)$')`,
      githubId:
        newGithubId ||
        sql`NULLIF(SUBSTRING(${users.githubId}::text FROM '^deleted_[0-9]+_(.*)$'), '')::integer`,
      githubUsername:
        newGithubUsername ||
        sql`SUBSTRING(${users.githubUsername} FROM '^deleted_[0-9]+_(.*)$')`,
      deletionMethod: null,
    })
    .where(eq(users.id, userId))
}

export async function listSoftDeletedUsers() {
  return db
    .select()
    .from(users)
    .where(isNotNull(users.deletedAt))
    .orderBy(sql`"deletedAt" DESC`)
}

export async function setUserAsEmailVerifiedIfEmailMatches(
  userId: number,
  email: string
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ emailVerified: true })
    .where(and(eq(users.id, userId), eq(users.email, email)))
    .execute()

  return result.count > 0 // Check if any rows were affected
}

export async function updateUserEmailAndSetEmailAsVerified(
  userId: number,
  email: string
): Promise<void> {
  await db
    .update(users)
    .set({
      email: email,
      emailVerified: true,
    })
    .where(eq(users.id, userId))
}
