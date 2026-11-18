# Prompt Chain Tool

Superadmin-only tool to create prompt chains, edit and reorder their steps, run them on an image, and review the generated output.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your keys.
3. In Supabase SQL Editor, run `supabase/schema.sql` (safe: it only adds new tables, it does not change your existing prompt_chains tables).
4. Make sure your profile row has `is_superadmin = true`.
5. Supabase → Auth → URL Configuration: add `http://localhost:3000/**` and your Vercel URL with `/**`.
6. `npm run dev`

## Deploy
Push to GitHub, import into a new Vercel project, add the same env vars, and turn off Deployment Protection.
