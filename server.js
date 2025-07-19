const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { env } = require('process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Set your desired password here
const VIEW_PASSWORD = env.VIEW_PASSWORD ; // Default password, can be overridden by .env file

// you may use this format also       const VIEW_PASSWORD = env.VIEW_PASSWORD || 'HomeStream123@'; // Default password, can be overridden by .env file


// Store the latest frame and connected clients
let latestFrame = null;
let connectedClients = new Set();
let lastFrameTime = Date.now();

// Middleware for receiving JPEG frames
app.use(express.raw({
  type: 'image/jpeg',
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Stream endpoint
app.post('/stream', (req, res) => {
  if (!req.rawBody || req.rawBody.length === 0) {
    return res.status(400).json({ error: 'No frame data received' });
  }

  latestFrame = req.rawBody;
  lastFrameTime = Date.now();

  // Broadcast to all WebSocket clients
  let clientsSent = 0;
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(latestFrame, { binary: true });
      clientsSent++;
    }
  });

  res.status(200).json({ 
    success: true,
    clients: clientsSent,
    frameSize: req.rawBody.length
  });
});

// WebSocket handler
wss.on('connection', (ws) => {
  connectedClients.add(ws);
  
  // Send latest frame if available
  if (latestFrame) {
    ws.send(latestFrame, { binary: true });
  }

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

// Serve HTML viewer directly with password protection
app.get('/', (req, res) => { 
  const { password } = req.query; // Get password from query parameters

  if (password === VIEW_PASSWORD) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ESP32-CAM Stream Viewer</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; text-align: center; }
          #stream { width: 100%; background: black; display: block; margin: 20px 0; }
          .stats { background: #f8f8f8; padding: 15px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>ESP32-CAM Live Stream</h1>
          <img id="stream" alt="Live Stream">
          <div class="stats">
            <p>Status: <span id="status">Connecting...</span></p>
            <p>FPS: <span id="fps">0</span></p>
            <p>Last Update: <span id="lastUpdate">Never</span></p>
          </div>
        </div>

        <script>
          const streamImg = document.getElementById('stream');
          const statusEl = document.getElementById('status');
          const fpsEl = document.getElementById('fps');
          const lastUpdateEl = document.getElementById('lastUpdate');

          let frameCount = 0;
          let fps = 0;
          let lastFrameTime = 0;
          let ws;

          function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(\`\${protocol}//\${window.location.host}\`);

            ws.onopen = () => {
              statusEl.textContent = 'Connected';
            };

            ws.onmessage = (event) => {
              if (event.data instanceof Blob) {
                frameCount++;
                const now = Date.now();
                if (lastFrameTime > 0) {
                  fps = Math.round(1000 / (now - lastFrameTime));
                }
                lastFrameTime = now;

                const url = URL.createObjectURL(event.data);
                streamImg.onload = () => URL.revokeObjectURL(url);
                streamImg.src = url;

                fpsEl.textContent = fps;
                lastUpdateEl.textContent = new Date().toLocaleTimeString();
              }
            };

            ws.onclose = () => {
              statusEl.textContent = 'Disconnected - Reconnecting...';
              setTimeout(connectWebSocket, 1000);
            };

            ws.onerror = (error) => {
              statusEl.textContent = 'Connection Error';
              console.error('WebSocket error:', error);
            };
          }

          connectWebSocket();
        </script>
      </body>
      </html>
    `);
  } else {
    res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f0f0; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #d9534f; }
          p { color: #555; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Access Denied</h1>
          <p>Please provide the correct password to view the stream.</p>
          <p>Example: <pre>http://localhost:${process.env.PORT || 3000}/?password=your_secret_password</pre></p>
        </div>
      </body>
      </html>
    `);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: connectedClients.size,
    lastFrame: latestFrame ? {
      size: latestFrame.length,
      age: Date.now() - lastFrameTime
    } : null
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Web viewer: http://localhost:${PORT}`);
  console.log(`Stream endpoint: POST http://localhost:${PORT}/stream`);
});