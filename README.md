# Dante Screen

Minimal 1:1 screen mirroring over WebRTC with a Node server and WebSocket signaling.

## Setup

```powershell
npm install
npm start
```

Open / to watch (viewer). Open /sender.html to start Dante Screen.

## TURN for mobile/cellular
- Easiest: Metered TURN. Set env vars on your host and redeploy:
  - METERED_DOMAIN = your-subdomain (no protocol)
  - METERED_API_KEY = your secret key
  The app will fetch credentials from https://YOUR_SUBDOMAIN.metered.live and use them.
- Or provide static TURN:
  - TURN_URL = turn:host:3478,turns:host:5349
  - TURN_USERNAME = user
  - TURN_CREDENTIAL = pass
