# WebRTC Screen Mirror (Local)

A minimal 1:1 screen sharing site using WebRTC with a Node (Express) static server and WebSocket signaling.

Notes:
- Works on localhost without HTTPS. For remote access over the internet, you need HTTPS and likely a TURN server.
- Single viewer only in this minimal version.

## Setup

1) Install dependencies

```powershell
npm install
```

2) Run the server

```powershell
npm start
```

3) Use it
- Open http://localhost:3000/sender.html, click "Start sharing" (choose your screen/window/tab).
- Click "Copy viewer link" and open it on the viewing device (must reach your machine; on LAN it’s fine).

## Security
- Screen capture prompts are handled by the browser.
- No authentication is implemented; use on trusted networks.
