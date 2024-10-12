import React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface PasswordResetEmailProps {
  resetCode: string
  userName: string
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  resetCode,
  userName,
}) => (
  <Html>
    <Head />
    <Preview>Reset your password</Preview>
    <Body className="bg-background font-sans">
      <Container className="bg-card mx-auto p-8 mb-16">
        <Section className="px-12">
          <Text className="text-foreground text-base leading-6">
            Hello {userName},
          </Text>
          <Text className="text-foreground text-base leading-6">
            We received a request to reset your password. If you didn't make
            this request, you can ignore this email.
          </Text>
          <Text className="text-foreground text-base leading-6">
            Your password reset code is:
          </Text>
          <Text className="bg-muted text-primary font-bold text-2xl tracking-wider my-4 p-3 text-center rounded-md">
            {resetCode}
          </Text>
          <Text className="text-foreground text-base leading-6">
            Please enter this code on the password reset page to create a new
            password.
          </Text>
          <Hr className="border-border my-5" />
          <Text className="text-muted-foreground text-sm leading-5">
            This code will expire in 10 minutes. If you didn't request a
            password reset, please ignore this email or contact support if you
            have concerns.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default PasswordResetEmail
