# ESP32-CAM Stream Viewer Server
This project provides a simple yet effective solution for streaming JPEG video frames from a source (like an ESP32-CAM) to multiple web clients. It uses Node.js with Express for the HTTP server and WebSockets for efficient, real-time broadcasting of frames.
## Features
  -Real-time Video Streaming: Broadcasts JPEG frames to all connected web clients via WebSockets.
  -Simple HTTP POST Endpoint: Easily receive JPEG frames from devices (e.g., ESP32-CAM) on the /stream endpoint.
  -Built-in Web Viewer: Includes a basic HTML page to view the live stream directly in your browser, complete with FPS and update time statistics.
  -CORS Enabled: Allows cross-origin requests, making it flexible for various client applications.
  -Health Check Endpoint: Monitor the server's status, connected clients, and the freshness of the last received frame.

## Getting Started
### Prerequisites
install NodeJS and npm on your local machine 
### Installation 
  -clone the repo using ``` gh repo clone MushuRam01/esp32cam-relay ``` 
  -install dependenancies ``` npm i ```
  -start the server ``` npm start ```
### Usage
  -You will be able to view the stream from an esp32 cam from anywhere if you host this code on a service like railway.com 
  -To host your own instance on a service just fork/copy the repo and link it to your sevice. It should be readily deployable 
### Esp32-CAM Setup
The code for the Esp-CAM can be found on my GitHub repo named esp32-HTTPS-stream . Can also be accesed by [This Link](https://github.com/MushuRam01/esp32-HTTPS-stream). This code streams to page that uses this code and is hosted on railway.com

### Contributing
Feel free to fork the repository, open issues, or submit pull requests if you have suggestions or improvements.
