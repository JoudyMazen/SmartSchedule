#!/usr/bin/env node

/**
 * Lightweight Yjs websocket server for SmartSchedule real-time collaboration.
 *
 * Start with:
 *   node scripts/yjs-server.js
 *
 * Configure host/port via YJS_HOST / YJS_PORT (or PORT) environment variables.
 */

const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils.js');

const port = parseInt(process.env.YJS_PORT || process.env.PORT || '1234', 10);
const host = process.env.YJS_HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SmartSchedule Yjs websocket server is running.\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  try {
    const origin = req.headers.host ? `http://${req.headers.host}` : `http://localhost:${port}`;
    const requestUrl = req.url ? new URL(req.url, origin) : new URL('/', origin);
    const docName = requestUrl.pathname.slice(1) || 'default';
    const remoteAddress = req.socket?.remoteAddress || 'unknown';
    console.log(`[yjs] client connected`, { docName, remoteAddress });

    setupWSConnection(conn, req, {
      docName,
      gc: true,
    });
  } catch (error) {
    console.error('Failed to setup Yjs websocket connection', error);
    conn.close();
  }
});

server.listen(port, host, () => {
  console.log(`[yjs] websocket server listening on ws://${host}:${port}`);
});

