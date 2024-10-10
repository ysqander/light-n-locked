import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InvitationEmailProps {
  inviteUrl: string
  teamName: string
  inviterName: string
}

export const InvitationEmail: React.FC<InvitationEmailProps> = ({
  inviteUrl,
  teamName,
  inviterName,
}) => (
  <Html>
    <Head />
    <Preview>You've been invited to join {teamName} on our platform</Preview>
    <Body className="bg-background font-sans">
      <Container className="bg-card mx-auto p-8 mb-16">
        <Section className="px-12">
          <Text className="text-foreground text-base leading-6">Hello,</Text>
          <Text className="text-foreground text-base leading-6">
            You've been invited by {inviterName} to join the {teamName} team on
            our platform.
          </Text>
          <Button
            href={inviteUrl}
            className="bg-primary text-primary-foreground font-bold text-base py-3 px-5 rounded-md no-underline text-center block w-full"
          >
            Join the team
          </Button>
          <Text className="text-foreground text-base leading-6">
            If you don't want to accept this invitation, you can ignore this
            email. The invitation link will expire in 7 days.
          </Text>
          <Hr className="border-border my-5" />
          <Text className="text-muted-foreground text-sm leading-5">
            If you're having trouble with the button above, copy and paste the
            URL below into your web browser:
          </Text>
          <Text className="text-primary text-sm leading-6 break-all">
            {inviteUrl}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InvitationEmail
