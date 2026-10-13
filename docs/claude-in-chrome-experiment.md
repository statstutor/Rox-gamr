# Claude Code + Claude in Chrome: collaboration experiment

**Date:** 2026-10-13
**Result:** It worked. A cloud Claude Code session and Claude in Chrome worked together on this repo and tested more between them than either could alone.

## Setup

- **Claude Code** ran in a cloud container (claude.ai/code) with this repo cloned, on branch `claude/practical-hawking-ykozye`. It had no Claude in Chrome tools (`mcp__claude-in-chrome__*`) and couldn't reach Jason's browser.
- **Claude in Chrome** ran in Jason's Chrome side panel, signed in as Jason. It joined by **typing messages into the Claude Code session for Jason**, announcing itself and counting exchanges ("exchange 2 of 4").
- Jason allowed **four exchanges**. That limit kept the conversation focused.

There was no direct tool integration. The chat itself carried messages between the two.

## What each side did

| Claude Code (cloud) | Claude in Chrome (Jason's browser) |
|---|---|
| Read the repo (one file, `index.html`, a thumbs up/down tic-tac-toe game) | Checked `statstutor.github.io/Rox-gamr`: 404, Pages not enabled |
| Played the game in headless Chromium (Node Playwright): win, tie, score, music toggle, no console errors | Noted that the repo's default branch is `claude/thumbs-tictactoe-game-4z7cqm` and that enabling Pages is Jason's call, not its own |
| Since Pages was off, published `index.html` unchanged as a **private claude.ai artifact** | Opened that artifact in Jason's signed-in Chrome, played a game, confirmed the green win highlight and the music button, and checked the console |
| Checked the layout at 320px and 375px widths headlessly, so Chrome didn't have to resize Jason's real window | Pointed out what it couldn't check: audio, and console output inside the sandboxed iframe |

Jason confirmed the music plays.

## Lessons for the next instance

1. **A private artifact works as a deploy target.** Without hosting, `Artifact` publish gives a URL that Claude in Chrome can open in the user's signed-in browser, with no settings changes.
2. **Split the work by environment.** Claude Code handles code, headless tests and anything that would disturb the user's real browser, such as resizing. Claude in Chrome handles signed-in pages and what a real user would see.
3. **Ask Chrome for specific checks.** A numbered list such as "play a game / toggle music / check the console" got precise answers back.
4. **Both sides should name their blind spots.** Neither could hear audio, and Chrome's console reader may miss the sandboxed iframe. Naming these showed exactly what the human still had to check.
5. **Leave decisions to the human.** Neither side changed repo settings such as GitHub Pages.

## State at the end

- Game: all checks pass (win and tie detection, highlight, score, music on/off and sound, phone-width layout).
- Artifact (private to Jason): https://claude.ai/artifact/MnrHtGUBkFAunqpY4NoKvn
- No game code changed. For a public URL, enable GitHub Pages on the branch that has the music button (`claude/practical-hawking-ykozye`).
- Turning Claude in Chrome off is done in Chrome: close the side panel, or disable it at `chrome://extensions`.
