import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
export const emailDomain = process.env.RESEND_DOMAIN
