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

interface ConfirmationEmailProps {
  verificationCode: string
  userName: string
}

export const ConfirmationEmail: React.FC<ConfirmationEmailProps> = ({
  verificationCode,
  userName,
}) => (
  <Html>
    <Head />
    <Preview>Confirm your email address</Preview>
    <Body className="bg-background font-sans">
      <Container className="bg-card mx-auto p-8 mb-16">
        <Section className="px-12">
          <Text className="text-foreground text-base leading-6">
            Hello {userName},
          </Text>
          <Text className="text-foreground text-base leading-6">
            Thank you for signing up. To complete your registration, please
            confirm your email address.
          </Text>
          <Text className="text-foreground text-base leading-6">
            Your verification code is:
          </Text>
          <Text className="bg-muted text-primary font-bold text-2xl tracking-wider my-4 p-3 text-center rounded-md">
            {verificationCode}
          </Text>
          <Text className="text-foreground text-base leading-6">
            Please enter this code on the verification page to confirm your
            email address.
          </Text>
          <Hr className="border-border my-5" />
          <Text className="text-muted-foreground text-sm leading-5">
            This code will expire in 10 minutes. If you didn't request this
            verification, you can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ConfirmationEmail
