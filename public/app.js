import * as Y from 'https://cdn.jsdelivr.net/npm/yjs@13.6.18/+esm';
import { WebsocketProvider } from 'https://cdn.jsdelivr.net/npm/y-websocket@2.1.0/+esm';

const FILES = [
  { key: 'index.html', language: 'html', starter: '<h1>Hello class 👋</h1>\n<p>Edit collaboratively.</p>' },
  { key: 'styles.css', language: 'css', starter: 'body { font-family: sans-serif; }\nh1 { color: #2563eb; }' },
  { key: 'script.js', language: 'javascript', starter: "console.log('Hello from collaborative JS');" }
];

const loginPanel = document.getElementById('loginPanel');
const workspace = document.getElementById('workspace');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const whoami = document.getElementById('whoami');
const roomLabel = document.getElementById('roomLabel');
const roomInput = document.getElementById('roomInput');
const changeRoomBtn = document.getElementById('changeRoom');
const logoutBtn = document.getElementById('logoutBtn');
const tabs = document.getElementById('tabs');
const preview = document.getElementById('preview');

let editor;
let currentUser;
let currentRoom;
let activeFile = FILES[0].key;
let ydoc;
let provider;
const models = new Map();
const unsubscribers = [];

function getRoomFromUrl() {
  return new URLSearchParams(window.location.search).get('room') || 'demo-room';
}

function setRoomInUrl(room) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', room);
  history.replaceState({}, '', url);
}

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

const renderPreview = debounce(() => {
  const html = models.get('index.html')?.getValue() || '';
  const css = models.get('styles.css')?.getValue() || '';
  const js = models.get('script.js')?.getValue() || '';
  preview.srcdoc = `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
}, 120);

function bindTextModel(ytext, model) {
  if (!ytext.length) {
    ytext.insert(0, model.getValue());
  } else {
    model.setValue(ytext.toString());
  }

  const yObserver = () => {
    const yValue = ytext.toString();
    if (model.getValue() !== yValue) {
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: yValue }], () => null);
    }
    renderPreview();
  };

  ytext.observe(yObserver);

  const sub = model.onDidChangeContent((event) => {
    if (event.isFlush) {
      return;
    }
    const next = model.getValue();
    if (next === ytext.toString()) {
      return;
    }

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, next);
    }, 'local');

    renderPreview();
  });

  unsubscribers.push(() => {
    ytext.unobserve(yObserver);
    sub.dispose();
  });
}

function mountTabs() {
  tabs.innerHTML = '';
  for (const file of FILES) {
    const button = document.createElement('button');
    button.className = `tab ${file.key === activeFile ? 'active' : ''}`;
    button.textContent = file.key;
    button.addEventListener('click', () => {
      activeFile = file.key;
      editor.setModel(models.get(file.key));
      mountTabs();
    });
    tabs.appendChild(button);
  }
}

async function setupMonaco() {
  await new Promise((resolve) => {
    window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
    window.require(['vs/editor/editor.main'], resolve);
  });

  if (!editor) {
    editor = monaco.editor.create(document.getElementById('editor'), {
      theme: 'vs-dark',
      minimap: { enabled: false },
      automaticLayout: true
    });
  }
}

function cleanupCollab() {
  unsubscribers.splice(0).forEach((fn) => fn());
  models.forEach((m) => m.dispose());
  models.clear();
  provider?.destroy();
  ydoc?.destroy();
}

async function joinRoom(room) {
  await setupMonaco();
  cleanupCollab();

  currentRoom = room;
  setRoomInUrl(room);
  roomLabel.textContent = `• room: ${room}`;
  roomInput.value = room;

  ydoc = new Y.Doc();
  provider = new WebsocketProvider(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`, `room:${room}`, ydoc);
  provider.awareness.setLocalStateField('user', { name: currentUser.username });

  for (const file of FILES) {
    const model = monaco.editor.createModel(file.starter, file.language);
    models.set(file.key, model);
    bindTextModel(ydoc.getText(file.key), model);
  }

  editor.setModel(models.get(activeFile));
  mountTabs();
  renderPreview();
}

async function checkSession() {
  const res = await fetch('/api/session');
  if (!res.ok) {
    return null;
  }
  return res.json();
}

async function login(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || 'Login failed');
  }

  return res.json();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
}

async function boot() {
  const session = await checkSession();
  if (session?.user) {
    currentUser = session.user;
    loginPanel.classList.add('hidden');
    workspace.classList.remove('hidden');
    whoami.textContent = `Logged in as ${currentUser.username}`;
    await joinRoom(getRoomFromUrl());
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const result = await login(username, password);
    currentUser = result.user;
    whoami.textContent = `Logged in as ${currentUser.username}`;
    loginPanel.classList.add('hidden');
    workspace.classList.remove('hidden');
    await joinRoom(getRoomFromUrl());
  } catch (error) {
    loginError.textContent = error.message;
  }
});

changeRoomBtn.addEventListener('click', async () => {
  const room = roomInput.value.trim();
  if (!room) return;
  await joinRoom(room);
});

logoutBtn.addEventListener('click', async () => {
  await logout();
  cleanupCollab();
  workspace.classList.add('hidden');
  loginPanel.classList.remove('hidden');
});

boot();
