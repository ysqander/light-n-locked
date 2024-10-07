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
import { eq, and } from 'drizzle-orm'
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
  let createdTeam: typeof teams.$inferSelect | null = null

  if (inviteId && userData.email) {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, userData.email),
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
      throw new Error('Invalid or expired invitation')
    }
  } else {
    const newTeam: NewTeam = {
      name: `${userData.email}'s Team`,
    }

    ;[createdTeam] = await db.insert(teams).values(newTeam).returning()

    if (!createdTeam) {
      throw new Error('Failed to create team')
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

  await db.insert(teamMembers).values(newTeamMember)
  await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP)

  return { user: createdUser, team: createdTeam }
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
