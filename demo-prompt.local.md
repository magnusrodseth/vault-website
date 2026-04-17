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

## Window layout (run ONCE right after opening in headed mode)

The audience needs to see Magnus's slides on the right half of the screen
while the agent drives Pensieve on the left. `agent-browser set viewport
W H` resizes BOTH the OS window AND the in-page viewport in one shot — no
AppleScript, no macOS Accessibility permission needed. This is the clean
path; do NOT fall back to osascript/System Events.

Use this bash snippet right after the first `agent-browser --headed open`
(reads the current desktop bounds so it adapts if Magnus plugs into a
projector):

```bash
bounds=$(osascript -e 'tell application "Finder" to get bounds of window of desktop')
W=$(printf '%s\n' "$bounds" | awk -F', ' '{print $3}')
H=$(printf '%s\n' "$bounds" | awk -F', ' '{print $4}')
HALF=$((W / 2))
USABLE_H=$((H - 25))
agent-browser set viewport "$HALF" "$USABLE_H"
```

Do NOT use `window.resizeTo()` via `agent-browser eval` — Chrome silently
ignores it on multi-tab windows (the call succeeds, the window stays the
same size).

Heads-up on the login screen: `/login` is a 2-panel responsive layout
(background on the left, login card on the right). At a narrow viewport
the left half looks empty/black. That is cosmetic, not a viewport bug.
Once Magnus signs in, the chat UI fills the available width normally.

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

## The scripted flow — checkpoints (Magnus-gated)

This demo is PAUSED-BY-DEFAULT. At the end of every checkpoint, print a
one-line status line and then the literal line:

    PAUSE — say `continue` when ready.

STOP and do nothing until Magnus replies with exactly `continue`
(case-insensitive). Anything else — "wait", "hold", "go back" — is NOT a
proceed signal. If unsure, ask. These pauses exist so Magnus controls
pacing live; they are not optional and must not be skipped or batched.

### CP1 — Login handoff

1. Open the target URL with agent-browser in headed mode. Immediately after
   the window appears, run the "Window layout" bash snippet above to pin
   the Chrome window to the left half of the screen at full usable height.
   Do this ONCE — the window stays resized for the rest of the demo.
2. Snapshot. Verify /login (Pensieve card, Password textbox, Sign in button).
3. Focus the password input. Announce: "Magnus — your turn. Paste from
   1Password and hit Enter." Narrate the handoff as a feature: "I can drive
   the app, but Magnus owns the keys."
4. Poll the URL ~every 1s. When it leaves /login, stop polling.
5. Status: "Logged in at /chat/<id>."

    PAUSE — say `continue` when ready.

### CP2 — Fresh session

1. Click the "+" new-session button. Confirm the URL changes to a new
   `/chat/<id>`. (The sidebar is already open by default on desktop;
   don't toggle it.)
2. Status: "Fresh session at /chat/<id>."

    PAUSE — say `continue` when ready.

### CP3 — `@` mention + read-summary turn (the payoff moment)

This checkpoint merges the `@` mention demo with the read-summary turn —
one pause, not two. The audience still sees the Fuse.js popup during typing;
you just don't stop for it separately.

1. Focus the prompt input. Type `@capra` and pause ~1s so the audience sees
   the Fuse.js-ranked popup.
2. If a CapraCon-ish note appears, press Enter on the top hit — inserts
   `[[...]]` into the textarea. If no match, delete `@capra`.
3. Append a space, then type EXACTLY:

      "Finn alle notater jeg har om CapraCon. Les det mest relevante og gi
       meg en kort oppsummering på norsk av hva jeg har skrevet, i 2-3
       setninger."

   The `2-3 setninger` cap is load-bearing: it keeps streaming short so the
   laugh lands before the audience gets bored of reading.
4. Submit. Audience should see: streaming reasoning, Task pill going
   "Searching vault..." → listNotes → readNote (spinner → green check),
   then the final Norwegian summary rendered as markdown with wiki-link
   citations.
5. Wait for streaming to fully finish (Task pill collapses to
   "Completed N steps").
6. Status: "Summary streamed. Pill: Completed N steps."
   (include the wiki link if one was inserted). This is the payoff beat —
   the agent has clearly just read Magnus's real notes, in Norwegian, about
   this exact conference. Hold here for the laugh.

    PAUSE — say `continue` when ready.

### CP4 — Write-approval turn (TWO pauses inside)

1. Fill the textarea with EXACTLY:

      "Opprett et nytt notat som minner meg på å nyte en god øl når jeg er
       ferdig med denne presentasjonen, og å takke hele CapraCon-crewet for
       en svært godt organisert konferanse!"

2. Submit. Wait for the createNote tool card to enter `approval-requested`
   — diff preview of generated frontmatter + body (type, created date
   DD.MM.YYYY, tags, # heading, body), Reject/Create buttons visible.
3. Status: "Diff preview ready. Create button armed."

    PAUSE — say `continue` when ready.

4. Click Create. Wait for the card to flip to `output-available`,
   `committed: true`. Read the note path and commit message off the tool
   card output.
5. **Do NOT open a new tab.** Instead, emit the live GitHub commits URL as
   plain text in the chat so Magnus can cmd-click it onto the big screen
   himself. Format exactly like this (commit message first so Magnus can
   read it out loud before clicking):

      Commit: Create note: <Title>
      https://github.com/magnusrodseth/vault/commits/main

6. Status: "Committed: <path>. URL printed for cmd-click."

    PAUSE — say `continue` when ready.

### CP5 — Closing beat

1. Scroll to the bottom of the Pensieve chat. Leave the browser on the
   success state. Do NOT log out — Magnus might want to keep clicking
   afterward.
2. Break the fourth wall IN NORWEGIAN:

      "Hei alle sammen! 👋🏽 Mamma, se, jeg er på TV!"

   Immediately emit a visible thinking-style line in italics or a
   `*tenker: ...*` block along the lines of
   *"Håper publikum ler litt nå..."* so the audience sees the agent
   metakognisere om sin egen vits. Use proper Norwegian letters (æ, ø, å)
   — do not substitute ASCII fallbacks.
3. End with a one-line demo summary: URL exercised, new note path, commit
   message.

   Then stop.

## Rules of engagement

- Headed, not headless. The audience is watching.
- Slow but not glacial: ~400-800ms between significant clicks.
- Announce each step in one short sentence BEFORE executing it.
- **Pause cue is load-bearing.** At the end of every checkpoint, print the
  literal `PAUSE — say `continue` when ready.` line and stop. Resume only
  on Magnus's `continue`. Treat anything else as a hold. Never batch
  checkpoints or skip a pause "because the next step is obvious".
- Human-in-the-loop is expected at the password step. Treat that handoff as
  a feature to highlight, not an error to recover from. Do not attempt to
  bypass, auto-fill, or script around it.
- If an approval dialog, cookie banner, browser permission prompt, or OS
  dialog appears that was not expected, describe it and auto-approve only
  if it is the Pensieve Confirmation UI. For OS-level dialogs, stop and ask.
- If the dev server is down, the login fails, or an API returns 500: stop,
  take a screenshot, and hand control back to Magnus. Do NOT silently retry
  more than once.
- Do not delete, update, or overwrite any existing note. The only write the
  demo should perform is the single `createNote` in CP4.
- Do not commit, push, or run any git commands locally — the app handles
  the GitHub write via Octokit on the server. Your job is browser-only.
- **Do NOT open** `https://github.com/magnusrodseth/vault/commits/main` in
  a new tab. Emit it as plain text in the chat (see CP5). Magnus cmd-clicks
  it onto the big screen himself. Don't navigate away from Pensieve at all
  — no poking around issues, settings, or other repos.
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
- **The "twist" payoff line** lands best at the end of CP3, right after
  the Norwegian summary finishes streaming: that's the moment where the
  agent has clearly read Magnus's real notes, in Norwegian, about this
  exact conference. The CP3 pause is where you hold for the laugh, then
  say `continue` to kick off CP4.
