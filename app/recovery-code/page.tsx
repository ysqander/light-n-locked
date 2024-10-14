import Link from 'next/link'
import { getCurrentSession } from '@/lib/auth/diy'
import { getUserRecoverCode } from '@/lib/server/user'
import { redirect } from 'next/navigation'
import { globalGETRateLimit } from '@/lib/server/request'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Page() {
  if (!globalGETRateLimit()) {
    return 'Too many requests'
  }
  const { session, user } = await getCurrentSession()
  if (session === null) {
    return redirect('/sign-in')
  }
  if (!user.emailVerified) {
    return redirect('/verify-email')
  }
  if (!user.registered2FA) {
    return redirect('/2fa/setup')
  }
  if (!session.twoFactorVerified) {
    return redirect('/2fa')
  }
  const recoveryCode = await getUserRecoverCode(user.id)
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Recovery Code
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Your Recovery Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Your recovery code is:</p>
            <p className="text-lg font-medium text-center mb-4">
              {recoveryCode}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              You can use this recovery code if you lose access to your second
              factors.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Next
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
