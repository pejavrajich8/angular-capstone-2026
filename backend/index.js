require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const PokerGame = require('./poker');
const BotAI = require('./botAI');

// Initialize Firebase Admin SDK
let db = null;
try {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccountKey) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    db = admin.firestore();
    console.log('Firebase Admin SDK initialized');
  } else {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set. Poker currency integration disabled.');
    console.warn('To enable: Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with your service account JSON.');
  }
} catch (error) {
  console.warn('⚠️  Firebase Admin SDK initialization failed:', error.message);
  console.warn('Poker will work without Firebase currency integration.');
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: ['http://localhost:8100', 'http://localhost:4200'],
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 3333;

// Fail fast if API key is missing
if (!process.env.ODDS_API_KEY) {
  console.error('ERROR: ODDS_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_BASE_URL = 'https://api.odds-api.io/v3';
const DECK_API_BASE_URL = 'https://deckofcardsapi.com/api/deck';

app.use(express.json());

// CORS (allow Ionic dev + your deployed hosting)
// Set BACKEND_ALLOWED_ORIGINS in Render to a comma-separated list, e.g.
// https://your-app.web.app,https://your-app.firebaseapp.com
const allowedOrigins = [
  'http://localhost:8100',
  'http://localhost:4200',
  ...(process.env.BACKEND_ALLOWED_ORIGINS
    ? process.env.BACKEND_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : []),
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl/postman) with no Origin header
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);

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

// get scores / results for a sport
app.get('/api/scores', async (req, res) => {
  const sport = req.query.sport || 'american-football';
  try {
    const data = await odsFetch(`${ODDS_BASE_URL}/scores?apiKey=${ODDS_API_KEY}&sport=${sport}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching scores:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// static fallback (if you want to serve built frontend from ../frontend/dist)
app.use('/', express.static(path.join(__dirname, '..', 'frontend', 'dist')));

//BLACKJACK API
app.get('/api/deck/create', async (_req, res) => {
  try {
    const response = await fetch(`${DECK_API_BASE_URL}/new/shuffle/?deck_count=1`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error creating deck:', error.message);
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/deck/draw', async (req, res) => {
  const deckId = req.query.deckId;
  const count = req.query.count || 1;

  if (!deckId) {
    return res.status(400).json({ error: 'deckId is required' });
  }

  try {
    const response = await fetch(`${DECK_API_BASE_URL}/${deckId}/draw/?count=${count}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error drawing cards:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// Poker Game Management
const pokerGames = new Map();
const playerSockets = new Map();

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  socket.on('joinGame', async (data, callback) => {
    try {
      const { tableId, playerName, firebaseUid, difficulty = 'medium' } = data;
      const playerId = socket.id;

      // Deduct buy-in from Firebase if available
      const buyInAmount = 1000;
      if (firebaseUid && db) {
        try {
          await db.collection('users').doc(firebaseUid).update({
            currency: admin.firestore.FieldValue.increment(-buyInAmount),
          });
          console.log(`Deducted $${buyInAmount} buy-in from user ${firebaseUid}`);
        } catch (error) {
          console.warn('Could not deduct buy-in from Firebase:', error.message);
        }
      }

      let game = pokerGames.get(tableId);
      if (!game) {
        game = new PokerGame(tableId, 6, 1000);
        pokerGames.set(tableId, game);

        // Add bot players
        for (let i = 0; i < 3; i++) {
          const botId = `bot-${uuidv4()}`;
          game.addPlayer(botId, `Bot ${i + 1}`, true, 1000);
          playerSockets.set(botId, { isBot: true, difficulty: difficulty });
        }
      }

      const result = game.addPlayer(playerId, playerName, false);
      if (result.success) {
        playerSockets.set(playerId, { socket, tableId, difficulty, firebaseUid });
        socket.join(tableId);

        callback({ success: true, game: game.getGameState() });
        io.to(tableId).emit('gameStateUpdate', game.getGameState());
      } else {
        callback({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error joining game:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('playerAction', (data, callback) => {
    try {
      const { tableId, action, amount = 0 } = data;
      const game = pokerGames.get(tableId);

      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }

      const result = game.processPlayerAction(socket.id, action, amount);
      if (result.success) {
        callback({ success: true });
        io.to(tableId).emit('gameStateUpdate', game.getGameState());

        // Process next player actions
        setTimeout(() => processNextAction(tableId), 500);
      } else {
        callback({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error processing action:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('claimDemoChips', (data, callback) => {
    try {
      const { tableId } = data;
      const game = pokerGames.get(tableId);

      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }

      const player = game.players.find(p => p.id === socket.id);
      if (!player) {
        callback({ success: false, error: 'Player not found' });
        return;
      }

      const chipAmount = 5000;
      player.chipStack += chipAmount;

      callback({ success: true, gameState: game.getGameState() });
      io.to(tableId).emit('gameStateUpdate', game.getGameState());
      io.to(tableId).emit('message', { player: player.name, text: `claimed $${chipAmount} demo chips!` });
    } catch (error) {
      console.error('Error claiming chips:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('startGame', (data, callback) => {
    try {
      const { tableId } = data;
      console.log('Starting game for tableId:', tableId);
      console.log('Available tables:', Array.from(pokerGames.keys()));
      
      const game = pokerGames.get(tableId);

      if (!game) {
        console.error('Game not found for tableId:', tableId);
        callback({ success: false, error: 'Game not found' });
        return;
      }

      if (game.players.length < 2) {
        callback({ success: false, error: 'Need at least 2 players' });
        return;
      }

      startNewRound(tableId);
      callback({ success: true });
      io.to(tableId).emit('gameStateUpdate', game.getGameState());
    } catch (error) {
      console.error('Error starting game:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('disconnect', async () => {
    console.log('Player disconnected:', socket.id);
    const playerData = playerSockets.get(socket.id);
    playerSockets.delete(socket.id);

    // Remove from all games but keep tables alive for rejoin
    for (const [tableId, game] of pokerGames.entries()) {
      const player = game.players.find(p => p.id === socket.id);
      if (player && player.chipStack > 0 && playerData && playerData.firebaseUid && db) {
        // Refund remaining chips to Firebase if available
        try {
          await db.collection('users').doc(playerData.firebaseUid).update({
            currency: admin.firestore.FieldValue.increment(player.chipStack),
          });
          console.log(`Refunded $${player.chipStack} to user ${playerData.firebaseUid}`);
        } catch (error) {
          console.error('Error refunding chips:', error);
        }
      }
      
      game.removePlayer(socket.id);
      // Only delete table if no players at all (including bots)
      // This allows human players to rejoin later
      if (game.players.length === 0) {
        pokerGames.delete(tableId);
      } else if (game.players.length > 0) {
        // Notify remaining players
        io.to(tableId).emit('gameStateUpdate', game.getGameState());
      }
    }
  });
});

function startNewRound(tableId) {
  const game = pokerGames.get(tableId);
  if (!game) return;

  game.gameState = 'preflop';
  game.roundNumber++;
  game.dealerIndex = (game.dealerIndex + 1) % game.players.length;
  game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
  game.pot = 0;
  game.currentBet = 0;
  game.communityCards = [];

  // Reset player state
  game.players.forEach(p => {
    p.isFolded = false;
    p.isAllIn = false;
    p.hasActed = false;
    p.currentBet = 0;
    p.holeCards = [];
    p.action = null;
  });

  game.shuffleDeck();
  game.dealHoleCards();
  game.postBlinds();

  // Send hole cards to each player
  game.players.forEach(player => {
    if (!player.isBot) {
      const playerSocket = playerSockets.get(player.id);
      if (playerSocket && playerSocket.socket) {
        playerSocket.socket.emit('holeCards', player.holeCards);
      }
    }
  });

  processNextAction(tableId);
}

function processNextAction(tableId) {
  const game = pokerGames.get(tableId);
  if (!game) return;

  // Check if only one player remains (everyone else folded)
  const activePlayers = game.players.filter(p => !p.isFolded);
  if (activePlayers.length === 1) {
    // End hand early - remaining player wins
    endHand(tableId);
    return;
  }

  const playerToAct = game.getPlayerToAct();

  if (!playerToAct) {
    // Round is over, move to next stage
    advanceGameStage(tableId);
    return;
  }

  if (playerToAct.isBot) {
    const botAI = new BotAI(playerSockets.get(playerToAct.id)?.difficulty || 'medium');
    const decision = botAI.makeDecision(game, playerToAct);

    setTimeout(() => {
      if (decision.action === 'raise') {
        game.processPlayerAction(playerToAct.id, decision.action, decision.amount);
      } else {
        game.processPlayerAction(playerToAct.id, decision.action);
      }
      io.to(tableId).emit('gameStateUpdate', game.getGameState());
      processNextAction(tableId);
    }, decision.delay);
  } else {
    io.to(tableId).emit('awaitingAction', {
      playerId: playerToAct.id,
      legalActions: game.getLegalActions(playerToAct),
      timeLimit: 30000,
    });
  }
}

function advanceGameStage(tableId) {
  const game = pokerGames.get(tableId);
  if (!game) return;

  switch (game.gameState) {
    case 'preflop':
      game.gameState = 'flop';
      game.dealCommunityCard();
      game.dealCommunityCard();
      game.dealCommunityCard();
      game.advanceRound();
      break;

    case 'flop':
      game.gameState = 'turn';
      game.dealCommunityCard();
      game.advanceRound();
      break;

    case 'turn':
      game.gameState = 'river';
      game.dealCommunityCard();
      game.advanceRound();
      break;

    case 'river':
      game.gameState = 'showdown';
      break;

    default:
      return;
  }

  io.to(tableId).emit('gameStateUpdate', game.getGameState());

  if (game.gameState === 'showdown') {
    endHand(tableId);
  } else {
    processNextAction(tableId);
  }
}

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

function endHand(tableId) {
  const game = pokerGames.get(tableId);
  if (!game) return;

  const activePlayers = game.players.filter(p => !p.isFolded);

  if (activePlayers.length === 1) {
    // Only one player left - they win
    const winner = activePlayers[0];
    winner.chipStack += game.pot;

    // Update Firebase if it's a human player
    updateFirebaseWinnings(tableId, winner);

    io.to(tableId).emit('handEnd', {
      winner: winner.name,
      winAmount: game.pot,
      handType: 'Everyone folded',
      gameState: game.getGameState(),
    });
  } else {
    // Multiple players - evaluate hands at showdown
    const result = game.determineWinner(activePlayers, game.communityCards);
    const winnersNames = result.winners.map(w => w.name).join(' & ');
    const splitAmount = Math.floor(game.pot / result.winners.length);
    
    result.winners.forEach(winner => {
      winner.chipStack += splitAmount;
      // Update Firebase for each winner
      updateFirebaseWinnings(tableId, winner, splitAmount);
    });

    io.to(tableId).emit('handEnd', {
      winner: winnersNames,
      winAmount: game.pot,
      handType: result.bestHand,
      winners: result.winners.map(w => ({ name: w.name, holeCards: w.holeCards })),
      gameState: game.getGameState(),
    });
  }

  game.gameState = 'finished';
}

async function updateFirebaseWinnings(tableId, player, amount = null) {
  // Only update Firebase for human (non-bot) players
  if (player.isBot || !db) return;

  const playerData = playerSockets.get(player.id);
  if (!playerData || !playerData.firebaseUid) return;

  const winAmount = amount || player.chipStack;
  try {
    await db.collection('users').doc(playerData.firebaseUid).update({
      currency: admin.firestore.FieldValue.increment(winAmount),
    });
    console.log(`Added $${winAmount} to user ${playerData.firebaseUid}`);
  } catch (error) {
    console.error('Error updating Firebase winnings:', error);
  }
}

// REST API endpoints for poker
app.post('/api/poker/createTable', (req, res) => {
  try {
    const tableId = uuidv4();
    const game = new PokerGame(tableId, 6, 1000);
    pokerGames.set(tableId, game);

    res.json({ success: true, tableId, game: game.getGameState() });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/poker/tables', (req, res) => {
  try {
    const tables = Array.from(pokerGames.entries()).map(([tableId, game]) => ({
      tableId,
      playerCount: game.players.length,
      maxPlayers: game.maxPlayers,
      gameState: game.gameState,
      pot: game.pot,
    }));

    res.json({ success: true, tables });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/poker/table/:tableId', (req, res) => {
  try {
    const game = pokerGames.get(req.params.tableId);

    if (!game) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    res.json({ success: true, game: game.getGameState() });
  } catch (error) {
    console.error('Error fetching table:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
