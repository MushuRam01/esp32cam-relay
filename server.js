const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let espSocket = null;
let browserSockets = [];

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log("🔌 WebSocket connected:", ip);

  ws.on('message', (msg) => {
    if (Buffer.isBuffer(msg)) {
      // Forward to all browser clients
      browserSockets.forEach(sock => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(msg);
        }
      });
    } else {
      const text = msg.toString();
      console.log("📨 Text message:", text);

      if (text.includes("hello from ESP32")) {
        espSocket = ws;
        console.log("📷 ESP32-CAM connected");
      } else {
        browserSockets.push(ws);
        console.log("👁️ Viewer connected");
      }
    }
  });

  ws.on('close', () => {
    if (ws === espSocket) espSocket = null;
    browserSockets = browserSockets.filter(sock => sock !== ws);
    console.log("❌ WebSocket disconnected:", ip);
  });
});

// Serve viewer UI
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
