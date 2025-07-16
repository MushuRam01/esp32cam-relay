// server.js
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
app.use(express.raw({ type: 'image/jpeg', limit: '2mb' }));
app.use(express.static('public'));

// CORS headers for ESP32-CAM
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// ESP32-CAM sends frames here
app.post('/stream', (req, res) => {
    if (req.body && req.body.length > 0) {
        latestFrame = req.body;
        lastFrameTime = Date.now();
        
        console.log(`Received frame: ${req.body.length} bytes, clients: ${connectedClients.size}`);
        
        // Broadcast to all connected clients
        connectedClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(latestFrame);
                } catch (error) {
                    console.error('Error sending to client:', error);
                    connectedClients.delete(client);
                }
            }
        });
    }
    res.sendStatus(200);
});

// WebSocket connection for clients
wss.on('connection', (ws) => {
    console.log('Client connected. Total clients:', connectedClients.size + 1);
    connectedClients.add(ws);
    
    // Send latest frame immediately if available and recent
    if (latestFrame && (Date.now() - lastFrameTime) < 10000) { // 10 seconds
        ws.send(latestFrame);
    }
    
    ws.on('close', () => {
        console.log('Client disconnected. Total clients:', connectedClients.size - 1);
        connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        clients: connectedClients.size,
        hasFrame: !!latestFrame,
        lastFrameAge: latestFrame ? Date.now() - lastFrameTime : null,
        uptime: process.uptime()
    });
});

// API endpoint to get stream status
app.get('/api/status', (req, res) => {
    res.json({
        isStreaming: latestFrame && (Date.now() - lastFrameTime) < 5000,
        connectedClients: connectedClients.size,
        lastFrameTime: lastFrameTime,
        serverTime: Date.now()
    });
});

// Main viewer page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ESP32-CAM Live Stream</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
            }
            
            .container {
                background: white;
                border-radius: 15px;
                padding: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                max-width: 800px;
                width: 100%;
            }
            
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 20px;
                font-size: 2.5em;
            }
            
            .stream-container {
                position: relative;
                background: #f0f0f0;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 20px;
                min-height: 300px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #stream {
                max-width: 100%;
                max-height: 500px;
                border-radius: 10px;
                display: none;
            }
            
            .loading {
                text-align: center;
                color: #666;
                font-size: 1.2em;
            }
            
            .status-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 20px;
            }
            
            .status {
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                color: white;
                transition: all 0.3s ease;
            }
            
            .status.connected {
                background: #28a745;
            }
            
            .status.disconnected {
                background: #dc3545;
            }
            
            .status.connecting {
                background: #ffc107;
                color: #333;
            }
            
            .info {
                display: flex;
                gap: 20px;
                font-size: 0.9em;
                color: #666;
            }
            
            .controls {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 20px;
            }
            
            button {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                background: #007bff;
                color: white;
                cursor: pointer;
                font-size: 1em;
                transition: background 0.3s ease;
            }
            
            button:hover {
                background: #0056b3;
            }
            
            button:disabled {
                background: #6c757d;
                cursor: not-allowed;
            }
            
            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 20px;
            }
            
            .stat-card {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
            }
            
            .stat-value {
                font-size: 1.5em;
                font-weight: bold;
                color: #007bff;
            }
            
            .stat-label {
                color: #666;
                font-size: 0.9em;
                margin-top: 5px;
            }
            
            @media (max-width: 600px) {
                .container {
                    padding: 20px;
                }
                
                h1 {
                    font-size: 2em;
                }
                
                .status-bar {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .info {
                    flex-direction: column;
                    gap: 5px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📹 ESP32-CAM Live Stream</h1>
            
            <div class="status-bar">
                <div id="status" class="status connecting">Connecting...</div>
                <div class="info">
                    <div>FPS: <span id="fps">0</span></div>
                    <div>Quality: <span id="quality">-</span></div>
                    <div>Clients: <span id="clients">0</span></div>
                </div>
            </div>
            
            <div class="stream-container">
                <div id="loading" class="loading">
                    <div>🔄 Connecting to stream...</div>
                    <div style="font-size: 0.9em; margin-top: 10px;">Make sure your ESP32-CAM is powered on and connected</div>
                </div>
                <img id="stream" alt="ESP32-CAM Stream">
            </div>
            
            <div class="controls">
                <button id="reconnect">🔄 Reconnect</button>
                <button id="fullscreen">🔍 Fullscreen</button>
                <button id="screenshot">📸 Screenshot</button>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-value" id="totalFrames">0</div>
                    <div class="stat-label">Total Frames</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="avgFps">0</div>
                    <div class="stat-label">Average FPS</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="dataReceived">0 MB</div>
                    <div class="stat-label">Data Received</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="uptime">0s</div>
                    <div class="stat-label">Connection Time</div>
                </div>
            </div>
        </div>
        
        <script>
            class ESP32StreamViewer {
                constructor() {
                    this.ws = null;
                    this.isConnected = false;
                    this.frameCount = 0;
                    this.totalDataReceived = 0;
                    this.startTime = Date.now();
                    this.lastFrameTime = Date.now();
                    this.fps = 0;
                    this.reconnectAttempts = 0;
                    this.maxReconnectAttempts = 10;
                    
                    this.initializeElements();
                    this.setupEventListeners();
                    this.connect();
                    this.startStatsUpdate();
                }
                
                initializeElements() {
                    this.elements = {
                        status: document.getElementById('status'),
                        stream: document.getElementById('stream'),
                        loading: document.getElementById('loading'),
                        fps: document.getElementById('fps'),
                        quality: document.getElementById('quality'),
                        clients: document.getElementById('clients'),
                        reconnect: document.getElementById('reconnect'),
                        fullscreen: document.getElementById('fullscreen'),
                        screenshot: document.getElementById('screenshot'),
                        totalFrames: document.getElementById('totalFrames'),
                        avgFps: document.getElementById('avgFps'),
                        dataReceived: document.getElementById('dataReceived'),
                        uptime: document.getElementById('uptime')
                    };
                }
                
                setupEventListeners() {
                    this.elements.reconnect.addEventListener('click', () => this.reconnect());
                    this.elements.fullscreen.addEventListener('click', () => this.toggleFullscreen());
                    this.elements.screenshot.addEventListener('click', () => this.takeScreenshot());
                    
                    this.elements.stream.addEventListener('load', () => {
                        this.elements.loading.style.display = 'none';
                        this.elements.stream.style.display = 'block';
                    });
                }
                
                connect() {
                    const wsUrl = window.location.protocol === 'https:' ? 
                        'wss://' + window.location.host : 
                        'ws://' + window.location.host;
                    
                    this.ws = new WebSocket(wsUrl);
                    
                    this.ws.onopen = () => {
                        this.updateStatus('Connected', 'connected');
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        this.startTime = Date.now();
                    };
                    
                    this.ws.onmessage = (event) => {
                        this.frameCount++;
                        this.totalDataReceived += event.data.size;
                        
                        const blob = new Blob([event.data], { type: 'image/jpeg' });
                        const url = URL.createObjectURL(blob);
                        this.elements.stream.src = url;
                        
                        // Calculate FPS
                        const now = Date.now();
                        this.fps = 1000 / (now - this.lastFrameTime);
                        this.lastFrameTime = now;
                        
                        // Clean up previous URL
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        
                        this.updateQualityInfo(event.data.size);
                    };
                    
                    this.ws.onclose = () => {
                        this.updateStatus('Disconnected', 'disconnected');
                        this.isConnected = false;
                        this.elements.stream.style.display = 'none';
                        this.elements.loading.style.display = 'block';
                        this.elements.loading.innerHTML = '🔄 Reconnecting...';
                        
                        if (this.reconnectAttempts < this.maxReconnectAttempts) {
                            setTimeout(() => this.connect(), 2000);
                            this.reconnectAttempts++;
                        } else {
                            this.elements.loading.innerHTML = '❌ Connection failed. Please refresh the page.';
                        }
                    };
                    
                    this.ws.onerror = (error) => {
                        console.error('WebSocket error:', error);
                        this.updateStatus('Error', 'disconnected');
                    };
                }
                
                updateStatus(text, className) {
                    this.elements.status.textContent = text;
                    this.elements.status.className = 'status ' + className;
                }
                
                updateQualityInfo(frameSize) {
                    const quality = frameSize > 50000 ? 'High' : frameSize > 20000 ? 'Medium' : 'Low';
                    this.elements.quality.textContent = quality;
                }
                
                startStatsUpdate() {
                    setInterval(() => {
                        this.elements.fps.textContent = Math.round(this.fps);
                        this.elements.totalFrames.textContent = this.frameCount;
                        this.elements.avgFps.textContent = Math.round(this.frameCount / ((Date.now() - this.startTime) / 1000));
                        this.elements.dataReceived.textContent = (this.totalDataReceived / (1024 * 1024)).toFixed(2) + ' MB';
                        this.elements.uptime.textContent = Math.round((Date.now() - this.startTime) / 1000) + 's';
                        
                        // Update client count via API
                        fetch('/api/status')
                            .then(response => response.json())
                            .then(data => {
                                this.elements.clients.textContent = data.connectedClients;
                            })
                            .catch(error => console.error('Error fetching status:', error));
                    }, 1000);
                }
                
                reconnect() {
                    if (this.ws) {
                        this.ws.close();
                    }
                    this.reconnectAttempts = 0;
                    this.updateStatus('Connecting...', 'connecting');
                    setTimeout(() => this.connect(), 500);
                }
                
                toggleFullscreen() {
                    if (!document.fullscreenElement) {
                        this.elements.stream.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
                }
                
                takeScreenshot() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = this.elements.stream.naturalWidth;
                    canvas.height = this.elements.stream.naturalHeight;
                    
                    ctx.drawImage(this.elements.stream, 0, 0);
                    
                    const link = document.createElement('a');
                    link.download = 'esp32-cam-screenshot-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.png';
                    link.href = canvas.toDataURL();
                    link.click();
                }
            }
            
            // Initialize the stream viewer when page loads
            document.addEventListener('DOMContentLoaded', () => {
                new ESP32StreamViewer();
            });
        </script>
    </body>
    </html>
    `);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ESP32-CAM Stream Server running on port ${PORT}`);
    console.log(`📹 Stream endpoint: POST /stream`);
    console.log(`🌐 Viewer: GET /`);
    console.log(`📊 Health check: GET /health`);
});