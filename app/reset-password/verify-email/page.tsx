import { PasswordResetEmailVerificationForm } from './components'
import { validatePasswordResetSessionRequest } from '@/lib/server/password-reset'
import { globalGETRateLimit } from '@/lib/server/request'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Page() {
  if (!globalGETRateLimit()) {
    return 'Too many requests'
  }
  const { session } = await validatePasswordResetSessionRequest()
  if (session === null) {
    return redirect('/forgot-password')
  }
  if (session.emailVerified) {
    if (!session.twoFactorVerified) {
      return redirect('/reset-password/2fa')
    }
    return redirect('/reset-password')
  }
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Verify your email address
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Enter Verification Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              We sent an 8-digit code to {session.email}.
            </p>
            <PasswordResetEmailVerificationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
