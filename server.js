const http = require('http');
const express = require('express');
const session = require('express-session');
const { WebSocketServer } = require('ws');
const cookie = require('cookie');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.PORT || 3000;

const DUMMY_ACCOUNTS = {
  alice: { password: 'class123', role: 'student' },
  bob: { password: 'class123', role: 'student' },
  charlie: { password: 'class123', role: 'student' },
  dana: { password: 'class123', role: 'teacher' }
};

const app = express();
app.use(express.json());

const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
});

app.use(sessionParser);
app.use(express.static('public'));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const account = DUMMY_ACCOUNTS[username];

  if (!account || account.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = { username, role: account.role };
  return res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.json({ user: req.session.user });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const cookies = cookie.parse(request.headers.cookie || '');
  const rawSid = cookies['connect.sid'];
  if (!rawSid) {
    socket.destroy();
    return;
  }

  sessionParser(request, {}, () => {
    if (!request.session?.user) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, {
    gc: true
  });
});

server.listen(PORT, () => {
  console.log(`Code Collab listening on http://localhost:${PORT}`);
});
