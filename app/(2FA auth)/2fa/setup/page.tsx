import { TwoFactorSetUpForm } from './components'
import { getCurrentSession } from '@/lib/auth/diy'
import { encodeBase64 } from '@oslojs/encoding'
import { createTOTPKeyURI } from '@oslojs/otp'
import { redirect } from 'next/navigation'
import { renderSVG } from 'uqr'
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
  if (!user.emailVerified || !user.email) {
    return redirect('/verify-email')
  }
  if (user.registered2FA && !session.twoFactorVerified) {
    return redirect('/2fa')
  }

  const totpKey = new Uint8Array(20)
  crypto.getRandomValues(totpKey)
  const encodedTOTPKey = encodeBase64(totpKey)

  const keyURI = createTOTPKeyURI('Demo', user.email, totpKey, 30, 6)

  const qrcode = renderSVG(keyURI)

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Set up two-factor authentication
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code with your authenticator app</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="mx-auto"
              style={{
                width: '200px',
                height: '200px',
              }}
              dangerouslySetInnerHTML={{
                __html: qrcode,
              }}
            ></div>
            <TwoFactorSetUpForm encodedTOTPKey={encodedTOTPKey} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
