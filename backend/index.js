const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());

// health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// example API
app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from backend' });
});

// static fallback (if you want to serve built frontend from ../frontend/dist)
app.use('/', express.static(path.join(__dirname, '..', 'frontend', 'dist')));

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
