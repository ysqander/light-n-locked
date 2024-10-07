import { db } from '@/lib/db/drizzle'
import {
  users,
  teams,
  teamMembers,
  invitations,
  type NewUser,
  type NewTeam,
  type NewTeamMember,
} from '@/lib/db/schema'
import { eq, and, or, isNotNull, like, sql, isNull } from 'drizzle-orm'
import { ActivityType } from '@/lib/db/schema'
import { logActivity } from '@/lib/db/data-access/activity'

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

export async function getUserWithTeamByGithubId(githubId: string) {
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
  await db
    .update(users)
    .set({
      deletedAt: sql`CURRENT_TIMESTAMP`,
      email: sql`CASE 
        WHEN email IS NOT NULL THEN CONCAT('deleted-', ${userId}::text, '-', SUBSTRING(email FROM 1 FOR 8))
        ELSE NULL
      END`,
      name: null,
      passwordHash: null,
      githubId: sql`CASE 
        WHEN github_id IS NOT NULL THEN CONCAT('deleted-', ${userId}::text, '-', SUBSTRING(github_id FROM 1 FOR 8))
        ELSE NULL
      END`,
      githubUsername: null,
      deletionMethod: sql`CASE 
        WHEN email IS NOT NULL THEN 'EMAIL'
        WHEN github_id IS NOT NULL THEN 'GITHUB'
        ELSE 'UNKNOWN'
      END`,
    })
    .where(eq(users.id, userId))

  // Remove user from team
  await db.delete(teamMembers).where(eq(teamMembers.userId, userId))
}

export async function findSoftDeletedUser(identifier: string) {
  const user = await db
    .select()
    .from(users)
    .where(
      and(
        or(
          like(users.email, `deleted-%-%${identifier}%`),
          like(users.githubId, `deleted-%-%${identifier}%`)
        ),
        isNotNull(users.deletedAt)
      )
    )
    .limit(1)

  return user[0] || null
}

export async function restoreSoftDeletedUser(
  userId: number,
  newEmail: string,
  newGithubId?: string
) {
  await db
    .update(users)
    .set({
      deletedAt: null,
      email: newEmail,
      githubId: newGithubId || null,
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
