import Link from 'next/link'
import {
  EmailVerificationForm,
  ResendEmailVerificationCodeForm,
} from './components'
import { getCurrentSession } from '@/lib/auth/diy'
import { redirect } from 'next/navigation'
import { getUserEmailVerificationRequestFromRequest } from '@/lib/server/email-verification'
import { globalGETRateLimit } from '@/lib/server/request'

export default async function Page() {
  if (!globalGETRateLimit()) {
    return 'Too many requests'
  }
  const { user } = await getCurrentSession()
  if (user === null) {
    return redirect('/sign-in')
  }

  // TODO: Ideally we'd sent a new verification email automatically if the previous one is expired,
  // but we can't set cookies inside server components.
  const verificationRequest = await getUserEmailVerificationRequestFromRequest()
  if (verificationRequest === null && user.emailVerified) {
    return redirect('/')
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Verify your email address
        </h1>
        <p className="text-center text-gray-600">
          We sent an 8-digit code to {verificationRequest?.email ?? user.email}.
        </p>
        <EmailVerificationForm />
        <div className="flex flex-col items-center space-y-4">
          <ResendEmailVerificationCodeForm />
          <Link
            href="/sign-up"
            className="text-sm text-orange-600 hover:text-orange-500 transition-colors"
          >
            Change your email (return to sign up)
          </Link>
        </div>
      </div>
    </div>
  )
}
