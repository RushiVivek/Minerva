# Minerva OPDS Server

Greenfield OPDS book server for EPUB libraries. The application is designed for Vercel, managed PostgreSQL, and Cloudinary-backed book assets.

## Initial structure

- `src/db/schema.ts`: metadata, tokens, and reading-progress schema.
- `src/lib/env.ts`: validated runtime configuration.
- `src/lib/auth.ts`: shared bearer-token primitives.
- `src/app/api/opds/2.0/catalog`: OPDS 2.0 catalog route.
- `src/app/api/opds/1.2/catalog`: OPDS 1.2 compatibility route.
- `src/app/api/opds/private`: authenticated private feeds for hidden books.
- `src/app/api/admin/books`: authenticated EPUB upload endpoint.
- `src/app/api/admin/tokens`: admin-only API-token creation, listing, and revocation.
- `src/app/api/progress`: bearer-token reading progress and bookmark sync.

The admin upload form is available at `/admin`. Configure `ADMIN_PASSWORD_HASH` with
`npm run auth:hash-password -- '<password>'`. Public OPDS is available at
`/api/opds/2.0/catalog`; private clients should use the private catalog endpoint
with Basic Auth or a bearer API token.

Copy `.env.example` to `.env.local`, configure the external services, then install dependencies and run the development server.

## Database and deployment

1. Create a free managed PostgreSQL database (Neon, Supabase, or Vercel Postgres).
2. Set `DATABASE_URL` in Vercel and locally.
3. Run `npm run db:migrate` against the configured database.
4. Configure Cloudinary credentials and set `NEXT_PUBLIC_APP_URL` to the custom HTTPS domain.
5. Deploy the project to Vercel. OPDS clients should use the deployed HTTPS URL, not a local development URL.

The current implementation uses Cloudinary private raw assets and returns signed download
URLs through the protected route. The browser admin form sends Basic Auth directly over HTTPS; the API upload endpoint
also requires admin Basic Auth. Do not expose it without HTTPS.
