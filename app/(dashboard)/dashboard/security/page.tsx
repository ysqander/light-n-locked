import { validateRequest } from '@/lib/auth/lucia'
import { redirect } from 'next/navigation'
import SecurityClientComponent from './securtiyClientComponent'

export default async function SecurityPage() {
  const { user } = await validateRequest()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium bold text-gray-900 mb-6">
        Security Settings
      </h1>
      <SecurityClientComponent user={user} />
    </section>
  )
}
