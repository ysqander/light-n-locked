import { ForgotPasswordForm } from './components'
import Link from 'next/link'
import { globalGETRateLimit } from '@/lib/server/request'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Page() {
  if (!globalGETRateLimit()) {
    return 'Too many requests'
  }
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Forgot your password?
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
            <div className="mt-4 text-center">
              <Link
                href="/sign-in"
                className="text-sm font-medium text-orange-600 hover:text-orange-500"
              >
                Back to Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
