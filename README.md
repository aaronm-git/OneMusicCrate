# OneMusicCrate

A music library management app that lets you import your Spotify library, clean up duplicate tracks, and keep everything portable for when you want to switch streaming services.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Auth:** better-auth (email/password, magic link, Spotify OAuth)
- **Database:** PostgreSQL via Drizzle ORM
- **Styling:** Tailwind CSS v4 + shadcn/ui (Base UI primitives)
- **State:** TanStack React Query
- **Email:** Resend (magic link delivery)

## Features

- **Spotify OAuth** Connect your Spotify account and import your full library
- **Library browser** Browse saved tracks and playlists with search
- **Duplicate detection** Find and clean up duplicate tracks across your library
- **In-app playback** Stream tracks directly with the built-in Spotify Web Playback SDK player
- **Account management** Set or change your password, manage connected services
- **Multi-service architecture** Designed to support additional streaming services (Apple Music, Tidal) in the future

## AI Tools Used

- **Claude Code** (Anthropic) — primary coding assistant for feature development, debugging, and code review
- **Codex** (OpenAI) — used for code generation and exploration

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in the required values
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run database migrations:
   ```bash
   pnpm db:migrate
   ```
4. Start the dev server:
   ```bash
   pnpm dev
   ```

## Issues Encountered

### Library table performance with 3,000+ tracks

Loading a full Spotify library into a single table caused significant performance issues. The DOM was rendering thousands of rows at once, leading to slow initial paint and sluggish scrolling.

**Solution:** Implemented row virtualization using `@tanstack/react-virtual`. Only the visible rows (plus a small overscan buffer) are rendered at any given time, keeping the DOM lightweight regardless of library size.

### Password form submit button not working

The "Set password" button on the account settings page did nothing when clicked. No validation errors, no network request, no feedback at all.

**Root cause:** The shadcn Button component uses Base UI's `Button` primitive, which defaults to `type="button"` instead of the standard HTML default of `type="submit"`. This meant clicking the button inside a `<form>` never triggered the form's `onSubmit` handler.

**Fix:** Added `type="submit"` explicitly to the submit button.
