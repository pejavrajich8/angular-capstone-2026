require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3333;

// Fail fast if API key is missing
if (!process.env.ODDS_API_KEY) {
  console.error('ERROR: ODDS_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_BASE_URL = 'https://api.odds-api.io/v3';

app.use(express.json());

//public folder
app.use(express.static(path.join(__dirname, 'public')));

// health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// example API
app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from backend' });
});

async function odsFetch(url) {
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Unexpected response from odds API (status ${response.status})`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// get list of sports
app.get('/api/sports', async (_req, res) => {
  try {
    const data = await odsFetch(`${ODDS_BASE_URL}/sports?apiKey=${ODDS_API_KEY}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching sports:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// get events for a sport
app.get('/api/events', async (req, res) => {
  const sport = req.query.sport || 'american-football';
  const limit = req.query.limit || 25;
  try {
    const data = await odsFetch(`${ODDS_BASE_URL}/events?apiKey=${ODDS_API_KEY}&sport=${sport}&limit=${limit}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching events:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// get odds for a specific event
app.get('/api/odds', async (req, res) => {
  const eventId = req.query.eventId;
  const bookmakers = req.query.bookmakers || ['Bet365', 'Unibet'].join(',');

  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  try {
    const data = await odsFetch(`${ODDS_BASE_URL}/odds?apiKey=${ODDS_API_KEY}&eventId=${eventId}&bookmakers=${bookmakers}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching odds:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// static fallback (if you want to serve built frontend from ../frontend/dist)
app.use('/', express.static(path.join(__dirname, '..', 'frontend', 'dist')));

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
