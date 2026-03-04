# Code Collab

A lightweight, browser-only collaborative editor for HTML/CSS/JS using **Yjs + Monaco**.

## Features
- Real-time collaboration on `index.html`, `styles.css`, and `script.js`
- Instant live preview in an iframe (no local installs for students)
- Dummy account login (server-side session cookie)
- Room-based collaboration (`?room=class-a`)
- Lightweight Node server suitable for small classrooms

## Dummy accounts
Use any of these:

| Username | Password |
| --- | --- |
| alice | class123 |
| bob | class123 |
| charlie | class123 |
| dana | class123 |

## Run locally
```bash
npm install
npm run dev
```

Then open: `http://localhost:3000`

## Notes on scalability
- Yjs CRDT updates are efficient for text collaboration.
- This demo uses one Node process + in-memory sessions and `y-websocket` docs.
- On an 8GB server, 30 concurrent users editing a few files is reasonable for this architecture.
- For production: add persistent session/doc storage, reverse proxy, and process supervision.
