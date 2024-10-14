import Link from 'next/link'
import { TwoFactorVerificationForm } from './components'
import { getCurrentSession } from '@/lib/auth/diy'
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
  if (session.twoFactorVerified) {
    return redirect('/')
  }
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Two-factor authentication
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Enter Authentication Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the code from your authenticator app.
            </p>
            <TwoFactorVerificationForm />
            <div className="mt-4 text-center">
              <Link
                href="/2fa/reset"
                className="text-sm font-medium text-primary hover:text-primary/90"
              >
                Use recovery code
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
