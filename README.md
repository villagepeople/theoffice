# Benefits: An Office Comedy

**Upper management needs you.**

A desktop browser game about keeping a fictional benefits office running amid
client cases, executive demands, loud coworkers, kitchen mishaps, and surprise
fire drills. Built with JavaScript, an isometric Canvas renderer, and an MVC
structure. All characters, incidents, and client cases are fictional.

## Play locally

Use Node.js 24 or newer. No dependency installation is required.

```sh
node server.mjs
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).
Run commands from the repository root.

## Features

- Ten roles covering benefits, retirement, Flex, COBRA, the call center,
  Accounting, MIS Helpdesk, MIS Developers, and Operations.
- A floor studio with movable departments and executive offices, furniture,
  walkway validation, undo, and JSON floor-plan import/export.
- Solo play and shared offices for up to four players, with room codes,
  shared cases, events, team chat, and host migration.
- Executive summons, nearby NPC conversations, an Overheard chatter feed,
  and optional browser read-aloud.
- Office navigation, readable department labels, and zoom controls.

Choose **Host office** to create a multiplayer room, or **Join office** with a
room code. Players must reach the same server. The local preview listens only
on the current computer; it is not an internet hosting service.

## Controls

| Action | Control |
| --- | --- |
| Walk | Click the floor, WASD, or arrow keys |
| Interact | E |
| Talk to an NPC | T |
| Team chat | Enter |
| Take a break | Space or Escape |

Solo play pauses during case dialogs. Multiplayer offices continue running.
Open **Floor studio** before starting an online office to customize its layout.

## Check and build

```sh
node check-model.mjs
node check-network.mjs
node check-client.mjs
node build-worker.mjs
```

The checks cover navigation and collisions, cases, events, saved games, floor
validation, multiplayer state and SQLite persistence, chat, task ownership,
executive summons, and client recovery. The build bundles the browser assets
and room API into `dist/server/index.js`.

## Project structure

| Path | Purpose |
| --- | --- |
| `dist/model.js` | Game rules and state |
| `dist/layout.js` | Floor geometry and validation |
| `dist/renderer.js` | Isometric Canvas view |
| `dist/app.js` | Controller and browser input |
| `dist/builder.js` | Floor studio |
| `dist/network.js` | Multiplayer client and reconnect |
| `dist/office-chat.js` | Chatter, team chat, and NPC conversation UI |
| `worker/room-service.js` | Authoritative multiplayer rooms and persistence |
| `worker/index.js` | Hosted request routing |
| `server.mjs` | Local HTTP preview and room API |
| `drizzle/` | Hosted database migrations |
| `.openai/hosting.json` | Existing Sites hosting configuration |

## Hosting

GitHub hosts this source repository. Full multiplayer also needs a running
backend; GitHub Pages cannot run the room API.

The Node preview uses in-memory rooms, which are cleared when it restarts.
The hosted Worker uses a Cloudflare D1 binding named `DB`; its schema is in
`drizzle/0000_multiplayer.sql`. The existing Sites deployment workflow provisions
and migrates that database. See `START-HERE.txt` for the current project details.

## Future direction

Mobile adaptation is deferred. The proposed training mode would give NPCs
role-specific knowledge and coaching skills; live AI agents and company-system
integrations are not implemented in this version.
