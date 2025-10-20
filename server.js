import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.redirect('/viewer.html?room=live');
});

// Provide ICE servers. If METERED_* is set, proxy credentials from Metered; else fall back to static TURN_* vars.
app.get('/config', async (_req, res) => {
  try {
    const domain = process.env.METERED_DOMAIN;
    const apiKey = process.env.METERED_API_KEY;
    if (domain && apiKey) {
      const url = `https://${domain}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data.iceServers)) return res.json({ iceServers: data.iceServers });
      }
    }
  } catch (_) {
    // ignore and fall back
  }

  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrls = process.env.TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnCred = process.env.TURN_CREDENTIAL;
  if (turnUrls && turnUser && turnCred) {
    iceServers.push({ urls: turnUrls.split(',').map(u => u.trim()), username: turnUser, credential: turnCred });
  }
  res.json({ iceServers });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// roomId -> { sender: WebSocket|null, viewer: WebSocket|null }
const rooms = new Map();

function getOrCreateRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { sender: null, viewer: null });
  return rooms.get(id);
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    const { type } = msg;

    if (type === 'join') {
      const { room: roomId, role } = msg;
      if (!roomId || !role) return;
      const room = getOrCreateRoom(roomId);
      ws.roomId = roomId;
      ws.role = role;

      if (role === 'sender') {
        // Replace existing sender, notify old viewer
        if (room.sender && room.sender !== ws) {
          try { room.sender.close(); } catch {}
        }
        room.sender = ws;
        send(ws, { type: 'joined', role: 'sender' });
        if (room.viewer) send(room.viewer, { type: 'sender-ready' });
      } else if (role === 'viewer') {
        if (room.viewer && room.viewer !== ws) {
          // Only one viewer supported in this minimal demo
          send(ws, { type: 'error', reason: 'viewer-exists' });
          return;
        }
        room.viewer = ws;
        send(ws, { type: 'joined', role: 'viewer' });
        if (room.sender) send(room.sender, { type: 'viewer-ready' });
      }
      return;
    }

    const room = rooms.get(ws.roomId);
    if (!room) return;

    // Route signaling between sender and viewer
    if (type === 'offer' && ws.role === 'sender') {
      send(room.viewer, { type: 'offer', sdp: msg.sdp });
    } else if (type === 'answer' && ws.role === 'viewer') {
      send(room.sender, { type: 'answer', sdp: msg.sdp });
    } else if (type === 'ice-candidate') {
      if (ws.role === 'sender') send(room.viewer, { type: 'ice-candidate', candidate: msg.candidate });
      else if (ws.role === 'viewer') send(room.sender, { type: 'ice-candidate', candidate: msg.candidate });
    } else if (type === 'leave') {
      try { ws.close(); } catch {}
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    const role = ws.role;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (role === 'sender' && room.sender === ws) {
      room.sender = null;
      if (room.viewer) send(room.viewer, { type: 'sender-disconnected' });
    } else if (role === 'viewer' && room.viewer === ws) {
      room.viewer = null;
      if (room.sender) send(room.sender, { type: 'viewer-disconnected' });
    }

    if (!room.sender && !room.viewer) rooms.delete(roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
