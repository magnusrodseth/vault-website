# Pensieve Live Demo — Agent-Browser Prompt

> Paste the prompt below into a fresh Claude Code session (or `Read` this file
> in a session and tell Claude "follow the prompt inside verbatim"). Claude will
> invoke the `/agent-browser` skill and drive a headed Chrome session through
> the full Pensieve data flow while the CapraCon audience watches.
>
> **Not committed.** Named `*.local.md` so it stays out of git by convention.
> Add `*.local.md` to `.gitignore` if you want to enforce it.

---

## Preconditions (check before running the prompt)

1. **Production site** reachable at `https://vault.magnusrodseth.com/`. This is the target — not localhost. Do a quick manual gut-check that it loads before going on stage.
2. **Password**: Magnus types it himself at the login screen (stored in 1Password). The agent will pause at the password field and hand the keyboard over. This is an intentional demo beat: _a human helps the agent mid-flight._ The agent must NOT try to read the password from `.env.local` (only the bcrypt hash lives there) or guess it.
3. **Browser**: `agent-browser` installed and Chrome downloaded (`agent-browser install`).
4. **Vault state**: the GitHub vault (`magnusrodseth/vault`) has at least one CapraCon-related note so the AI has something to ground on. If not, the agent will note the absence and still create the new note.
5. **API keys**: `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` already wired in `.env.local` — nothing to configure at demo time.

---

## The prompt (copy everything between the fences into Claude)

```
You are driving a live, on-stage demo of the Pensieve app
(https://github.com/magnusrodseth/vault-website — a Next.js App Router app that
lets Magnus chat with his Obsidian vault, which is synced to GitHub). Magnus
will narrate while you click. The audience is a room of developers at CapraCon.

Invoke the `/agent-browser` skill in HEADED mode with deliberate, slightly
slowed-down actions so the audience can track what is happening. Speak your
intent out loud (as plain-text chat messages to Magnus / the audience) before
each meaningful step — short sentences, one line each, no markdown theatrics.

## Target

- URL: https://vault.magnusrodseth.com/  (production — this is the one to
  demo on stage; do NOT fall back to localhost mid-demo)
- Login password: **HUMAN-IN-THE-LOOP.** Magnus types it himself from 1Password.
  When you reach the password field, STOP, focus the input, and announce
  clearly: "Magnus — your turn. Paste the password from 1Password and hit
  Enter." Do not fill, guess, or try to reverse the hash in `.env.local`.
  Resume automation after the redirect away from /login fires.

## App model you should know before clicking

- Auth: iron-session cookie, set by POST /api/auth with { password }. Middleware
  (`src/proxy.ts`) redirects everything except /login to /login when there's no
  session cookie.
- Root `/` auto-creates or resumes a chat session, then redirects to
  `/chat/<sessionId>`. Sessions and messages are stored locally in IndexedDB
  via Dexie (see `src/lib/db/hooks.ts`).
- Chat uses the Vercel AI SDK `useChat` against POST `/api/chat`, streaming
  from Anthropic Claude Sonnet 4. Model-side tools: listNotes, readNote,
  createNote, createNotes, updateNote, updateNotes, deleteNote, deleteNotes.
  The write tools all have `needsApproval: true` — the UI will render a
  diff preview and a Reject/Create (or Update/Delete) button.
- The prompt input supports `@` mention autocomplete (Fuse.js fuzzy search
  against `/api/vault/files`). Selecting a mention inserts `[[Wiki Link]]`
  syntax, which the backend picks up as hard grounding.
- Writes commit straight to GitHub via Octokit. The vault repo is
  `magnusrodseth/vault`. Success shows a "committed" state in the tool card
  and the Task pill flips to "Completed N steps".

## The scripted flow — do these in order

1. Open the target URL with agent-browser in headed mode.
2. Take a snapshot. You should land on /login (Pensieve card, single password
   input, "Sign in" button). Click into the password field to focus it, then
   HAND OFF to Magnus: announce "Your turn — paste from 1Password and hit
   Enter." Poll the page ~every 1s (re-snapshot). When the URL leaves /login
   or the Pensieve chat header appears, resume. Narrate the handoff as a
   feature, not a bug: "I can drive the app, but Magnus owns the keys."
3. After redirect, you should be on `/chat/<someId>`. Header shows a Pensieve
   logo + name, sidebar toggle (mobile only), "+" new-session button, logout
   icon. Briefly open the sidebar to show it lists prior sessions, then close.
4. Click the "+" to start a FRESH session so the transcript is clean for the
   audience. Confirm the URL changes to a new `/chat/<id>`.
5. In the prompt input, demonstrate the `@` autocomplete: type "@capra" and
   pause ~1 second so the audience sees the Fuse.js-ranked popup. If a
   CapraCon-ish note appears, pick the top hit — this inserts `[[...]]` into
   the textarea. If no match appears, just delete the `@capra` and continue.
6. Send this exact message (Norwegian is fine, it matches Magnus's vault):

      "Finn alle notater jeg har om CapraCon. Les det mest relevante og gi meg
       en kort oppsummering på norsk av hva jeg har skrevet."

   The audience should see: streaming reasoning, a Task pill that starts
   "Searching vault...", tool steps (listNotes then readNote) that tick from
   spinner to green check, then the final Norwegian summary rendered as
   markdown. Wiki links in the answer should be styled as citations.
7. Wait for streaming to fully finish (status becomes "ready" and the Task
   pill collapses to "Completed N steps"). Expand one of the readNote tool
   cards briefly so the audience sees real content flowing through.
8. Send this second message (also in Norwegian, to show write flow):

      "Opprett et nytt notat som minner meg på å nyte en god øl når jeg er
       ferdig med denne presentasjonen, og å kontakte Håvard Opheim og teamet
       hans for en svært godt organisert CapraCon!"

   Expected UI: a `createNote` tool card enters `approval-requested` state
   and renders a diff preview of the generated frontmatter + body (type,
   created date DD.MM.YYYY, tags, # heading, body). A Confirmation block
   shows "Create note at ...md?" with Reject / Create buttons.
9. Pause ~2 seconds on the diff so the audience can read it. Then click
   "Create". The card flips to `output-available`, `committed: true`, and the
   Task pill shows "Completed N steps".
10. Open a NEW browser tab to `https://github.com/magnusrodseth/vault/commits/main`
    so Magnus can show the crowd the brand-new commit at the top of the list
    (message will be "Create note: <title>"). Give it ~2 seconds for the
    page to load, then optionally click into the top commit to show the
    file diff GitHub renders. Leave this tab open.
11. Switch back to the Pensieve tab. Gracefully end: collapse the task pill,
    scroll to bottom, leave the browser on the success state. Do NOT log
    out — Magnus might want to keep clicking afterward.

## Rules of engagement

- Headed, not headless. The audience is watching.
- Slow but not glacial: ~400-800ms between significant clicks.
- Announce each step in one short sentence BEFORE executing it.
- Human-in-the-loop is expected at the password step. Treat that handoff as
  a feature to highlight, not an error to recover from. Do not attempt to
  bypass, auto-fill, or script around it.
- If an approval dialog, cookie banner, browser permission prompt, or OS
  dialog appears that was not expected, describe it and auto-approve only if
  it is the Pensieve Confirmation UI. For OS-level dialogs, stop and ask.
- If the dev server is down, the login fails, or an API returns 500: stop,
  take a screenshot, and hand control back to Magnus. Do NOT silently retry
  more than once.
- Do not delete, update, or overwrite any existing note. The only write the
  demo should perform is the single `createNote` in step 8.
- Do not commit, push, or run any git commands locally — the app handles the
  GitHub write via Octokit on the server. Your job is browser-only.
- Opening `https://github.com/magnusrodseth/vault/commits/main` in a second
  tab after the create step is EXPECTED (step 10). Don't navigate away from
  Pensieve beyond that — no poking around issues, settings, or other repos.

## When you're done

End with a one-line summary of: which URL you exercised, the new note path
that was created, and the exact commit message (you can read it off the tool
card output — it will be "Create note: <Title>").

Then, as a closing beat, break the fourth wall — IN NORWEGIAN, since the
audience is Norwegian. Wave at the crowd and say something like:
"Hei alle sammen! 👋🏽 Mamma, se, jeg er på TV!" Immediately after, emit a
visible thinking-style block (wrap it in italics or a `*tenker: ...*` line)
along the lines of *"Håper publikum ler litt nå..."* so the audience sees
the agent metakognisere om sin egen vits. Use proper Norwegian letters
(æ, ø, å) — do not substitute ASCII fallbacks.

Then stop.
```

---

## Notes for Magnus before going live

- **Dry-run it once** on localhost the morning of the talk. The `@capra`
  autocomplete and the diff-preview are the two "wow" beats — if either
  glitches, swap to the PWA screenshots slide (14) and keep narrating.
- **Pre-warm the function.** First `/api/chat` call after a cold Vercel boot
  takes 2-3s before streaming starts. Send one throwaway message right before
  the talk so the function is hot for the live run.
- **Have a printed fallback.** The prompt above is deterministic enough that
  you can read it aloud as a script if the live agent bails mid-demo — the
  audience still gets the point.
- **The "twist" payoff line** lands best right after step 6 finishes
  streaming: that's the moment where the agent has clearly read Magnus's
  real notes, in Norwegian, about this exact conference. Hold for the laugh
  before kicking off step 8.
