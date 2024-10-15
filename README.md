# Next.js SaaS Starter

This a lightweight saas template with github oauth, email/password 2fa, postgres and stripe.

This combines the works of two excellent contributors to the dev community:

- Lee robinson: who built the original [Next.js SaaS Starter](https://github.com/leerob/next-saas-starter)
- Pilcrow: the author of the Lucia auth library and great learning materials on rolling your own auth. https://lucia-next.pages.dev/

This tempalte take the original template by Robinspn and replaces JWT token auth with session auth.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Postgres](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Payments**: [Stripe](https://stripe.com/)
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/)
- **Email**: [Resend](https://resend.com/)
- **Authentication**: Roll your own

## Getting Started

```bash
git clone https://github.com/ysqander/light-n-locked
cd light-n-locked
pnpm install
```

## Running Locally

Use the included setup script to create your `.env` file:

```bash
pnpm db:setup
```

Then, run the database migrations:

```bash
pnpm db:migrate
pnpm db:push
```

To use github oauth and Resend email you need to creae API keys for each service and set the following environment variables i nthe .env file:

```bash
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
RESEND_API_KEY=
```

To start the dev server run:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.
