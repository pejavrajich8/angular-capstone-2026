require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());

//public folder
app.use(express.static(path.join(__dirname, 'public')));

// health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// example API
app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from backend' });
});

// get list of sports
app.get('/api/sports', async (_req, res) => {
  const apiKey = process.env.ODDS_API_KEY;
  try {
    const response = await fetch(`https://api.odds-api.io/v3/sports?apiKey=${apiKey}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sports' });
  }
});

// get events for a sport
app.get('/api/events', async (req, res) => {
  const apiKey = process.env.ODDS_API_KEY;
  const sport = req.query.sport || 'american-football';
  const limit = req.query.limit || 25;
  try {
    const response = await fetch(`https://api.odds-api.io/v3/events?apiKey=${apiKey}&sport=${sport}&limit=${limit}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// get odds for a specific event
app.get('/api/odds', async (req, res) => {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = req.query.eventId;
  const bookmakers = req.query.bookmakers || ['Bet365', 'Unibet'].join(',');

  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  try {
    const response = await fetch(
      `https://api.odds-api.io/v3/odds?apiKey=${apiKey}&eventId=${eventId}&bookmakers=${bookmakers}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch odds' });
  }
});


// static fallback (if you want to serve built frontend from ../frontend/dist)
app.use('/', express.static(path.join(__dirname, '..', 'frontend', 'dist')));

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
