import { redirect } from 'next/navigation'
import { Settings } from './settings'
import { getTeamForUser } from '@/lib/db/data-access/teams'
import { validateRequest } from '@/lib/auth/lucia'

export default async function SettingsPage() {
  const { user } = await validateRequest()

  if (!user) {
    redirect('/sign-in')
  }

  const teamData = await getTeamForUser(user.id)

  if (!teamData) {
    throw new Error('Team not found')
  }

  return <Settings teamData={teamData} />
}
