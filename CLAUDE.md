# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Mop** — a React + Firebase web app for tracking cleaning tasks shared between roommates in an apartment. Users sign in with Google, create a "team" (a household), invite roommates by email, then create/assign/complete cleaning tasks scoped to rooms. Also tracks a shared household supply inventory and a completions leaderboard.

The app was originally named "Cleanist" and was renamed to "Mop" — older branches and commits use the old name.

## Layout

Two separate npm projects:
- repo root — the Vite + React 19 frontend (ESM, `type: module`)
- `functions/` — Firebase Cloud Functions v2 (Node 24), its own `package.json` and dependencies

## Commands

From the repo root:

```bash
npm run dev        # Vite dev server with HMR
npm run build      # production build into dist/
npm run preview    # serve the built dist/ locally
npm run lint       # ESLint over the frontend
```

From `functions/`:

```bash
npm run lint       # ESLint over functions (separate, older config — see below)
npm run serve      # firebase emulators:start --only functions
npm run shell      # firebase functions:shell
npm run deploy     # firebase deploy --only functions
npm run logs       # firebase functions:log
```

**There is no test framework in this project.** No Vitest/Jest, no test files, no `npm test`. Don't invent a test command or claim tests pass. If verification is needed, run `npm run lint` and `npm run build`, or drive the app with `npm run dev`.

Two ESLint setups that do not share config: the frontend uses flat config (`eslint.config.js`, ESLint 10) with `react-hooks` and `react-refresh`; `functions/` uses legacy `.eslintrc.js` with `eslint-config-google` on ESLint 8. Lint each from its own directory.

## Deploying

Firebase project: `cleaner-app-e63bc`. Hosting serves `dist/` with a SPA rewrite (`**` → `/index.html`).

- **Hosting deploys automatically** via GitHub Actions: merge to `main` → live channel; opening a PR → preview channel (`.github/workflows/`).
- **Firestore rules, indexes, and functions do NOT deploy from CI.** They need manual `firebase deploy --only firestore:rules` / `--only functions`. Changing `firestore.rules` without deploying it means the change has no effect in production — mention this when editing rules.
- `functions/index.js` requires a `RESEND_API_KEY` secret in Firebase (`defineSecret`).

## Architecture

### State lives in App.jsx

`src/App.jsx` (~590 lines) is the single stateful hub. There is no router, no Redux/Zustand, and no React Context. Navigation is a `activeTab` string (`tasks` | `inventory` | `living-space` | `stats` | `profile` | `preferences`) rendered as conditionals inside `<main>`. Everything else is prop-drilled down.

`App.jsx` owns five `onSnapshot` subscriptions, all returning the unsubscribe function directly from `useEffect`:
1. **tasks** — scoped to the current workspace
2. **auth state** — `onAuthStateChanged`; also gates first-time profile setup
3. **teams** — `where('members', 'array-contains', user.uid)`
4. **team invites for the active workspace** (`workspaceInvites`) — every invite for the active team regardless of status; filtered to `pending` at the use site to show not-yet-accepted roommates. Actual members come from `activeTeam.members`, not this.
5. **invites addressed to me** — a deliberately separate listener; you aren't yet a member of the inviting team, so listener 4 cannot surface your own invites (see comment at `App.jsx:149`)

Plus a snapshot of the whole `users` collection into `usersMap` (uid → user doc), used everywhere to resolve names and avatars.

Render gates run in order before the main UI: `authLoading` → `<Login>` if no user → `<ProfileSetup>` if `profileComplete` is falsy.

### The workspace model — the central concept

Every user has a **personal** workspace plus up to **5 teams** (limit enforced in `Header.jsx`). The `workspace` state variable is either the literal string `'personal'` or a Firestore team document ID.

This sentinel shows up in every query, every security rule, and most components:
- **Personal task**: `workspace === 'personal'` **and** `ownerUid === user.uid`
- **Team task**: `workspace === <teamId>`, `ownerUid` is `null`, access granted to any member of that team

`src/utils/workspaceHelpers.js` exists because the `workspaces` collection (which stores per-workspace room lists) cannot use the bare `'personal'` sentinel — it would collide across users. `getWorkspaceDocId()` maps it to `personal_<uid>`. Use this helper whenever writing to `workspaces/`; use the raw `workspace` value for `tasks/` and `inventory/`.

Task filtering happens in two stages in `App.jsx`: generic filters (room/priority/assignee/date) produce `filteredTasks`, then a workspace re-check produces `workspaceTasks`. The second pass also tolerates legacy tasks with no `workspace` field, treating them as personal. Note `StatsPanel` receives the unfiltered `tasks`, deliberately — stats reflect the whole workspace, not the current filter.

### Firestore collections

All flat, top-level, no subcollections:

- `users/{uid}` — `displayName`, `firstName`, `lastName`, `email`, `photoURL`, `profileComplete`. Readable by any signed-in user (needed to render roommates' names); writable only by the owner.
- `teams/{teamId}` — `name`, `members: [uid]`, `createdBy`, `createdAt`
- `teamInvites/{inviteId}` — `teamId`, `teamName`, `inviterUid`, `inviteeEmail` (**always stored lowercased**), `status`: `pending` | `accepted` | `declined`
- `tasks/{taskId}` — `name`, `room`, `frequency`, `priority`, `dueDate`, `assignedTo`, `notes`, `lastCompleted`, `completionHistory[]`, `workspace`, `ownerUid`
- `inventory/{itemId}` — `name`, `quantity`, `workspace`, `addedBy`, `addedByName`
- `workspaces/{workspaceId}` — `rooms: [string]`; ID comes from `getWorkspaceDocId()`. The doc is created lazily on the first room edit, so treat a missing doc or empty `rooms` as "use `DEFAULT_ROOMS`" — that fallback is why room writes in `LivingSpace` send the full list rather than `arrayRemove`, since there may be nothing persisted to remove from.

`completionHistory` is an append-only array written with `arrayUnion`. Each entry snapshots `completedAt`, `completedBy`, `completedByName`, `dueAt`, and `wasLate` so history stays accurate even if the task is later edited. `wasLate` is derived at completion time (`null` when the task had no due date) precisely because `dueAt` alone can't answer it afterwards. `StatsPanel` derives the entire leaderboard and activity feed from these arrays — never overwrite the array wholesale.

Timestamps are inconsistent by collection: `lastCompleted` / `completedAt` are `Date.now()` millisecond numbers, `createdAt` is a Firestore `serverTimestamp()`, and `dueDate` is a string in **one of two shapes** — `YYYY-MM-DD` (no time given) or `YYYY-MM-DDTHH:mm` (time given). Check which you're dealing with before comparing.

**Never parse `dueDate` with `new Date(...)` directly.** `new Date('2026-07-31')` is read as UTC midnight and lands on the previous local day west of Greenwich, while `new Date('2026-07-31T14:00')` is read as local — so the bare constructor is inconsistent between the two shapes. Use `parseDueDate()`, which parses both locally and treats a date-only value as end-of-day (23:59:59.999) so a task due today isn't overdue at 00:01. Use `hasDueTime()` to branch on whether a time was set and `formatDueDate()` to render.

### Security rules are the real authorization boundary

`firestore.rules` is where access control actually lives — components do client-side guards (e.g. `if (!isCreator) return`) purely for UX. Team-scoped rules use `get(/databases/$(database)/documents/teams/$(...))` to check membership, so **a task or inventory document's `workspace` field must be a valid team ID** or the rule's `get()` fails and the operation is denied.

The `teams` update rule is deliberately fiddly: it permits the creator to do anything, plus self-join (`members.concat([uid])`), self-remove (`members.removeAll([uid])`), and no-op membership changes. Adding a new kind of team mutation usually means extending that disjunction.

The Firebase web config in `src/firebase.js` is committed and that's expected for Firebase web apps — those keys identify the project, they don't authorize anything. Don't "fix" it by moving it to env vars without reason.

### Date logic

`src/utils/dateHelpers.js` is the single source of truth for overdue/recurrence. `isOverdue()` handles the tricky cases: a completed one-time task is never overdue; recurring tasks derive their next due date from `lastCompleted` + `frequency`. `getNextDue()` supports `daily`/`weekly`/`biweekly`/`monthly`. Any new overdue check should call these rather than reimplementing the comparison.

Preference-driven durations (the "Completed" window) are stored as a single millisecond number, edited as days/hours/minutes via `msToParts`/`partsToMs`. `resolveCompletedWindowMs(userValue, teamValue)` is the precedence rule: a user's own value wins, `null`/absent means "follow the team", and neither set falls back to `DEFAULT_COMPLETED_WINDOW_MS`. Because `isRecentlyCompleted` reads the clock at render time, `TaskList` runs a 30s ticker so tasks actually leave the Completed section without an unrelated re-render.

Frequency values drift between files: `TaskForm` offers `once`/`daily`/`weekly`/`monthly`, while `dateHelpers` and `TaskItem`'s `FREQ_LABELS` also handle `biweekly`. Keep all three in sync when touching frequencies.

### Styling

`src/index.css` (~990 lines) is the entire design system and is explicitly the single source of truth — `src/App.css` is intentionally empty. Colors, spacing, radii, shadows, and the type scale are CSS custom properties on `:root` (teal brand palette; `Plus Jakarta Sans` via Google Fonts). Prefer `var(--teal-main)`, `var(--text-sm)`, `var(--radius-md)` etc. over literals.

Layout is a fixed sidebar + main area on desktop, collapsing to a bottom nav bar at `max-width: 640px`. Note that several components (`Header`, `App`'s filter dropdown, `Inventory`, `LivingSpace`) carry sizeable inline `style` objects rather than classes — inconsistent with the rest, but that's the existing pattern in those files.

Icons come from `lucide-react`. Emoji were deliberately removed from the UI in favor of Lucide icons — don't reintroduce them.

`useClickOutside` (`src/hooks/`) returns a ref to attach to any dropdown container; every menu in the app uses it to close on outside click.

## Known incomplete work

Be aware of these before "fixing" what looks broken:

- **The email function is unused.** `functions/sendEmail` is deployed but nothing in `src/` calls it (no `httpsCallable` anywhere), and its `from` address is still the placeholder `noreply@yourdomain.com`, which must be a Resend-verified domain to work.
- **Quiet Hours and Email Notifications persist but do nothing** — there is no reminder delivery anywhere in the app, so both are saved and marked in the UI with `<em>Saved, but reminders aren't sent yet.</em>`. The other preferences (default workspace, task assignment, completed-task window) are wired up and take effect.
- **`README.md` is still the untouched Vite template** plus a stray `# mop` line.

## Conventions

- Plain JavaScript with JSX — no TypeScript (`@types/react` is present but nothing is typed)
- Function declarations for components, `export default` at the bottom of the file
- Async Firestore writes are called directly from handlers; errors go to `console.error` with a short prefix (`'Error accepting invite:'`). A top-level `ErrorBoundary` in `main.jsx` catches render crashes.
- Destructured props with defaults (`allAssignees = []`) rather than PropTypes
- Feature work happens on branches named `<name>-updatesN` (`mop-updates1`), merged to `main` via PR — which is what triggers the hosting deploy
