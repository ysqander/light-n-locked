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
    <Body style={main}>
      <Container style={container}>
        <Section style={box}>
          <Text style={paragraph}>Hello,</Text>
          <Text style={paragraph}>
            You've been invited by {inviterName} to join the {teamName} team on
            our platform.
          </Text>
          <Button pX={20} pY={12} style={btn} href={inviteUrl}>
            Join the team
          </Button>
          <Text style={paragraph}>
            If you don't want to accept this invitation, you can ignore this
            email. The invitation link will expire in 7 days.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you're having trouble with the button above, copy and paste the
            URL below into your web browser:
          </Text>
          <Text style={url}>{inviteUrl}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InvitationEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const box = {
  padding: '0 48px',
}

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
}

const btn = {
  backgroundColor: 'hsl(var(--primary))',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
}

const url = {
  color: '#556cd6',
  fontSize: '14px',
  lineHeight: '24px',
  whiteSpace: 'nowrap',
  wordBreak: 'break-all',
}
