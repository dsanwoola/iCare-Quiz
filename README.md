# Neighbours Quiz Arena

Real-time, Kahoot-style quiz battles. Hosts create quizzes (or generate them with
AI) and run live games; players join with a 6-digit PIN or QR code and compete on a
live leaderboard.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind
- **Backend:** Firebase — Firestore (realtime data & game state), Firebase Auth
  (Google + email/password for hosts, anonymous for players), Cloud Storage
  (quiz/question images), Firebase AI Logic (Gemini) for AI quiz generation
- **Security:** Firestore & Storage Security Rules + App Check (reCAPTCHA Enterprise)
- **Hosting:** Firebase Hosting

## Features

- 6 question types: Multiple Choice, True/False, Multi-Select, Type-Answer,
  Numeric, and Ordering — each optionally with an image
- AI quiz generation from a topic prompt
- Real-time play via Firestore listeners with speed + streak scoring
- Team mode with combined team standings
- Per-quiz analytics dashboard (accuracy, hardest questions, response times)
- Public template library (browse, clone, and publish quizzes)
- CSV results export

## Local development

```bash
npm install
npm run dev
```

For App Check on `localhost`, copy `.env.example` to `.env.local` and set a
registered `VITE_APPCHECK_DEBUG_TOKEN` (see Firebase console → App Check → Apps →
Manage debug tokens).

## Build & deploy

```bash
npm run build      # tsc + vite build → dist/
npm run deploy     # build + firebase deploy
```

Pushes to `main` are built and deployed to Firebase Hosting automatically via
GitHub Actions (`.github/workflows/firebase-hosting.yml`).

## Project structure

- `src/react-app/` — pages, components, hooks, and the Firebase data layer (`lib/`)
- `src/shared/types.ts` — shared domain types & Zod schemas
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — backend config
- `firebase.json`, `.firebaserc` — Firebase project config

Firebase project: **icare-quiz-arena**.
