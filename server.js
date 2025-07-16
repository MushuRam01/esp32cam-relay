// server.js - Enhanced for Railway deployment
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store the latest frame and connected clients
let latestFrame = null;
let connectedClients = new Set();
let lastFrameTime = Date.now();

// Middleware
app.use(express.raw({
  type: 'image/jpeg',
  limit: '10mb', // Increased limit for larger frames
  verify: (req, res, buf) => {
    req.rawBody = buf; // Store raw buffer for validation
  }
}));

app.use(express.static('public'));

// Enhanced CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Content-Length');
    res.header('Access-Control-Max-Age', '86400');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Enhanced stream endpoint
app.post('/stream', (req, res) => {
    if (!req.rawBody || req.rawBody.length === 0) {
        console.log('Empty frame received');
        return res.status(400).json({ error: 'No frame data received' });
    }

    // Validate content type
    if (!req.headers['content-type']?.includes('image/jpeg')) {
        console.log('Invalid content type:', req.headers['content-type']);
        return res.status(400).json({ error: 'Invalid content type' });
    }

    latestFrame = req.rawBody;
    lastFrameTime = Date.now();
    
    console.log(`Frame received: ${req.rawBody.length} bytes from ${req.ip}`);

    // Broadcast to all connected clients
    let clientsSent = 0;
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(latestFrame, { binary: true });
                clientsSent++;
            } catch (error) {
                console.error('WebSocket send error:', error);
                connectedClients.delete(client);
            }
        }
    });

    res.status(200).json({ 
        success: true, 
        clients: clientsSent,
        frameSize: req.rawBody.length,
        timestamp: new Date().toISOString()
    });
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientId = req.headers['sec-websocket-key'] || Math.random().toString(36).substring(7);
    console.log(`New WebSocket connection: ${clientId}`);
    
    connectedClients.add(ws);
    
    // Send latest frame if available
    if (latestFrame && (Date.now() - lastFrameTime) < 10000) {
        ws.send(latestFrame, { binary: true });
    }
    
    ws.on('close', () => {
        console.log(`WebSocket closed: ${clientId}`);
        connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error (${clientId}):`, error);
        connectedClients.delete(ws);
    });
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        clients: {
            http: connectedClients.size,
            lastFrame: latestFrame ? {
                size: latestFrame.length,
                age: Date.now() - lastFrameTime
            } : null
        },
        environment: process.env.NODE_ENV || 'development'
    };
    res.json(status);
});

// API endpoint to get stream status
app.get('/api/status', (req, res) => {
    res.json({
        streaming: !!latestFrame,
        lastFrame: lastFrameTime,
        clients: connectedClients.size,
        serverTime: Date.now()
    });
});

// Serve the viewer page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Web interface: http://localhost:${PORT}`);
    console.log(`Stream endpoint: POST http://localhost:${PORT}/stream`);
});

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
        console.log(`${signal} received - shutting down`);
        wss.clients.forEach(client => client.close());
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});