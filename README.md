# SARP PM

SARP PM is a Next.js project management and cost-control app for construction and waterproofing projects. It tracks project master data, product and employee master lists, daily product/labour/expense costs, monthly invoices, profitability, and monthly project reports.

## Tech Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local development
- Database-backed login sessions

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Create the SQLite database and run migrations:

```bash
npx prisma migrate dev --name init
```

4. Seed example products, employees, projects, daily records, expenses, and invoices:

```bash
npm run prisma:seed
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Default seeded login:

- Email: `admin@sarp.local`
- Password: `ChangeMe123!`

Change this before using the app with real staff. You can also set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` before running the seed.

## User Accounts

The app now requires login. An admin can open the Users page and create accounts for employees, managers, and other admins.

Current role structure:

- `ADMIN`: can manage user accounts.
- `MANAGER`: can use the app, with permissions ready to be tightened later.
- `EMPLOYEE`: can use the app, with permissions ready to be tightened later.

## Deploying Online To Vercel

SQLite is useful for local development, but the online app must use a hosted database so employee edits are saved permanently. This repo includes two Prisma schemas:

- `prisma/schema.prisma`: local SQLite development.
- `prisma/schema.postgres.prisma`: online Postgres deployment.

Recommended hosting setup:

1. Create a GitHub repository for this project.
2. Create a Vercel account and import the GitHub repository.
3. Create a hosted Postgres database. Good simple options are Prisma Postgres from the Vercel Marketplace, Vercel Postgres, Neon, or Supabase.
4. Add these Vercel environment variables:

```bash
DATABASE_URL="postgresql://..."
ADMIN_NAME="Your Name"
ADMIN_EMAIL="your-email@example.com"
ADMIN_PASSWORD="use-a-strong-password"
```

5. In Vercel project settings, set the Build Command to:

```bash
npm run vercel-build
```

The `vercel-build` script generates Prisma Client from the Postgres schema, pushes the schema to the hosted database, and builds the Next.js app.

6. For first setup only, seed the hosted database from your computer after setting your local `DATABASE_URL` temporarily to the hosted Postgres URL:

```bash
npm run prisma:pg:seed
```

Important: the seed command clears and recreates starter data. Use it only when setting up a new empty production database.

After deployment, open the Vercel URL, sign in with the admin email/password, and create staff accounts from the Users page.

For day-to-day local work, keep using the normal SQLite commands:

```bash
npm run build
npm run dev
```
