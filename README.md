# Refract

Refract is a browser puzzle about drawing light through an optical bench. Connect each pair of matching emitters, thread every lens of its shape, and use every charge in the shared crystals. Beams can travel to any neighboring node, including diagonals, but cannot reuse or cross segments.

## Run

Install dependencies with `npm ci`, then run `npm run dev` and open the local address Vite prints. Build a self-contained static site with `npm run build`; the result is in `dist/`. Serve that directory from the root of any static server.

## Play

Choose **Campaign** for 24 authored boards, or **Cascade** for an endless sequence that climbs through five tiers. Press on an outlined emitter and drag across neighboring nodes. Release to keep a partial beam. Press an end to continue it, press a node along a beam to shorten it, or drag backward to undo one segment at a time.

Use the mouse, pen, or touch to trace and select buttons. Arrow keys or WASD move menu highlights; Enter or Space selects; Esc goes back. Press R to clear the board and M to mute sound. The on-screen CLEAR and BACK buttons work by touch too.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` to validate the source and simulation.
