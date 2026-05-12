const { v4: uuidv4 } = require('uuid');

class PokerGame {
  constructor(tableId, maxPlayers = 6, buyIn = 1000) {
    this.tableId = tableId;
    this.maxPlayers = maxPlayers;
    this.buyIn = buyIn;
    this.players = [];
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.gameState = 'waiting'; // waiting, preflop, flop, turn, river, showdown, finished
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.smallBlind = buyIn / 100;
    this.bigBlind = buyIn / 50;
    this.roundNumber = 0;
  }

  addPlayer(playerId, playerName, isBot = false, chipStack = this.buyIn) {
    if (this.players.length >= this.maxPlayers) {
      return { success: false, error: 'Table is full' };
    }

    const player = {
      id: playerId,
      name: playerName,
      isBot,
      chipStack,
      currentBet: 0,
      holeCards: [],
      isFolded: false,
      isAllIn: false,
      hasActed: false,
      action: null,
      position: this.players.length,
    };

    this.players.push(player);
    return { success: true, player };
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.players.forEach((p, i) => (p.position = i));
  }

  shuffleDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];

    for (let suit of suits) {
      for (let rank of ranks) {
        this.deck.push({ rank, suit });
      }
    }

    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  dealHoleCards() {
    for (let i = 0; i < 2; i++) {
      for (let player of this.players) {
        if (!player.isFolded) {
          player.holeCards.push(this.deck.pop());
        }
      }
    }
  }

  dealCommunityCard() {
    this.communityCards.push(this.deck.pop());
  }

  postBlinds() {
    const smallBlindPlayerIndex = (this.dealerIndex + 1) % this.players.length;
    const bigBlindPlayerIndex = (this.dealerIndex + 2) % this.players.length;

    const smallBlindPlayer = this.players[smallBlindPlayerIndex];
    const bigBlindPlayer = this.players[bigBlindPlayerIndex];

    smallBlindPlayer.chipStack -= this.smallBlind;
    smallBlindPlayer.currentBet = this.smallBlind;
    this.pot += this.smallBlind;

    bigBlindPlayer.chipStack -= this.bigBlind;
    bigBlindPlayer.currentBet = this.bigBlind;
    this.pot += this.bigBlind;

    this.currentBet = this.bigBlind;
  }

  getPlayerToAct() {
    // Find the next player who needs to act
    let index = this.currentPlayerIndex;
    let checked = 0;
    
    while (checked < this.players.length) {
      const player = this.players[index];
      if (!player.isFolded && !player.isAllIn && !player.hasActed) {
        return player;
      }
      index = (index + 1) % this.players.length;
      checked++;
    }
    
    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      return null; // Betting round is done
    }
    
    // Otherwise reset hasActed and continue (handles re-raises)
    this.players.forEach(p => {
      if (!p.isFolded && !p.isAllIn && p.currentBet < this.currentBet) {
        p.hasActed = false;
      }
    });
    
    index = this.currentPlayerIndex;
    checked = 0;
    while (checked < this.players.length) {
      const player = this.players[index];
      if (!player.isFolded && !player.isAllIn && !player.hasActed) {
        return player;
      }
      index = (index + 1) % this.players.length;
      checked++;
    }
    
    return null;
  }

  processPlayerAction(playerId, action, amount = 0) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const legalActions = this.getLegalActions(player);
    if (!legalActions.includes(action)) {
      return { success: false, error: 'Illegal action' };
    }

    switch (action) {
      case 'fold':
        player.isFolded = true;
        player.action = 'fold';
        break;

      case 'check':
        player.action = 'check';
        break;

      case 'call':
        const callAmount = Math.min(this.currentBet - player.currentBet, player.chipStack);
        player.chipStack -= callAmount;
        player.currentBet += callAmount;
        this.pot += callAmount;
        player.action = 'call';
        if (player.chipStack === 0) player.isAllIn = true;
        break;

      case 'raise':
        // Validate raise amount is legal
        const minRaise = Math.max(this.currentBet - player.currentBet, this.bigBlind);
        if (amount < minRaise) {
          return { success: false, error: `Minimum raise is ${minRaise}` };
        }
        
        const raiseAmount = Math.min(amount, player.chipStack + (player.currentBet - player.currentBet));
        const betAmount = this.currentBet - player.currentBet + raiseAmount;
        player.chipStack -= betAmount;
        player.currentBet += betAmount;
        this.pot += betAmount;
        
        // Update current bet to what all players now need to match
        this.currentBet = player.currentBet;
        player.action = `raise ${raiseAmount}`;
        
        // Reset hasActed for all other players so they can respond to the raise
        this.players.forEach(p => {
          if (p.id !== player.id && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        });
        
        if (player.chipStack === 0) player.isAllIn = true;
        break;

      case 'allIn':
        const allInAmount = player.chipStack;
        player.chipStack = 0;
        player.currentBet += allInAmount;
        this.pot += allInAmount;
        if (player.currentBet > this.currentBet) {
          this.currentBet = player.currentBet;
        }
        player.isAllIn = true;
        player.action = 'all-in';
        break;
    }

    player.hasActed = true;
    return { success: true };
  }

  getLegalActions(player) {
    const actions = [];
    const amountToCall = this.currentBet - player.currentBet;

    if (amountToCall > 0) {
      // Player must respond to a bet or raise
      actions.push('fold');
      if (player.chipStack >= amountToCall) {
        actions.push('call');
      }
      if (player.chipStack > amountToCall) {
        actions.push('raise');
      }
    } else {
      // Player can check or raise
      actions.push('check');
      if (player.chipStack > 0) {
        actions.push('raise');
      }
    }

    // Player can always go all-in if they have chips
    if (player.chipStack > 0) {
      actions.push('allIn');
    }

    return actions;
  }

  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => !p.isFolded && !p.isAllIn);
    
    // If only one player remains, betting is complete
    if (activePlayers.length <= 1) return true;
    
    // All active players must have acted
    if (!activePlayers.every(p => p.hasActed)) return false;
    
    // All active players must have matched the current bet
    return activePlayers.every(p => p.currentBet === this.currentBet || p.isAllIn);
  }

  advanceRound() {
    this.players.forEach(p => {
      p.hasActed = false;
      p.currentBet = 0;
    });
    this.currentBet = 0;
    this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
  }

  getRankValue(rank) {
    const rankValues = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return rankValues[rank];
  }

  evaluateHand(cards) {
    if (cards.length < 5) return { rank: 0, name: 'High Card' };

    const sortedCards = cards.sort((a, b) => this.getRankValue(b.rank) - this.getRankValue(a.rank));
    const ranks = sortedCards.map(c => this.getRankValue(c.rank));
    const suits = sortedCards.map(c => c.suit);

    // Check for royal flush, straight flush, four of a kind, etc.
    if (this.isStraightFlush(ranks, suits)) return { rank: 8, name: 'Straight Flush' };
    if (this.isFourOfAKind(ranks)) return { rank: 7, name: 'Four of a Kind' };
    if (this.isFullHouse(ranks)) return { rank: 6, name: 'Full House' };
    if (this.isFlush(suits)) return { rank: 5, name: 'Flush' };
    if (this.isStraight(ranks)) return { rank: 4, name: 'Straight' };
    if (this.isThreeOfAKind(ranks)) return { rank: 3, name: 'Three of a Kind' };
    if (this.isTwoPair(ranks)) return { rank: 2, name: 'Two Pair' };
    if (this.isPair(ranks)) return { rank: 1, name: 'Pair' };

    return { rank: 0, name: 'High Card' };
  }

  isStraightFlush(ranks, suits) {
    return this.isStraight(ranks) && this.isFlush(suits);
  }

  isFourOfAKind(ranks) {
    for (let i = 0; i < ranks.length - 3; i++) {
      if (ranks[i] === ranks[i + 1] && ranks[i] === ranks[i + 2] && ranks[i] === ranks[i + 3]) {
        return true;
      }
    }
    return false;
  }

  isFullHouse(ranks) {
    const countMap = {};
    ranks.forEach(r => (countMap[r] = (countMap[r] || 0) + 1));
    const counts = Object.values(countMap);
    return counts.includes(3) && counts.includes(2);
  }

  isFlush(suits) {
    return suits.slice(0, 5).every(s => s === suits[0]);
  }

  isStraight(ranks) {
    for (let i = 0; i < ranks.length - 4; i++) {
      if (ranks[i] - ranks[i + 1] === 1 && ranks[i + 1] - ranks[i + 2] === 1 &&
          ranks[i + 2] - ranks[i + 3] === 1 && ranks[i + 3] - ranks[i + 4] === 1) {
        return true;
      }
    }
    return false;
  }

  isThreeOfAKind(ranks) {
    for (let i = 0; i < ranks.length - 2; i++) {
      if (ranks[i] === ranks[i + 1] && ranks[i] === ranks[i + 2]) {
        return true;
      }
    }
    return false;
  }

  isTwoPair(ranks) {
    let pairs = 0;
    for (let i = 0; i < ranks.length - 1; i++) {
      if (ranks[i] === ranks[i + 1]) {
        pairs++;
        i++;
      }
    }
    return pairs === 2;
  }

  isPair(ranks) {
    for (let i = 0; i < ranks.length - 1; i++) {
      if (ranks[i] === ranks[i + 1]) return true;
    }
    return false;
  }

  getGameState() {
    return {
      tableId: this.tableId,
      gameState: this.gameState,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        chipStack: p.chipStack,
        currentBet: p.currentBet,
        isFolded: p.isFolded,
        isAllIn: p.isAllIn,
        hasActed: p.hasActed,
        position: p.position,
        action: p.action,
        holeCardCount: p.holeCards.length,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
    };
  }

  // Find best 5-card hand from 7 cards (hole cards + community cards)
  findBestHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    
    // Generate all possible 5-card combinations
    const combinations = this.generateCombinations(allCards, 5);
    
    let bestHand = null;
    let bestRank = -1;
    let bestValue = -1;

    for (const hand of combinations) {
      const evaluation = this.evaluateHand(hand);
      const handValue = this.getHandValue(evaluation, hand);
      
      if (handValue > bestValue) {
        bestValue = handValue;
        bestRank = evaluation.rank;
        bestHand = { cards: hand, evaluation, value: handValue };
      }
    }

    return bestHand || { cards: allCards.slice(0, 5), evaluation: this.evaluateHand(allCards.slice(0, 5)), value: 0 };
  }

  // Generate all combinations of n cards from an array
  generateCombinations(cards, n) {
    if (n === 1) return cards.map(c => [c]);
    if (cards.length === n) return [cards];

    const combinations = [];
    for (let i = 0; i <= cards.length - n; i++) {
      const head = cards[i];
      const tailCombos = this.generateCombinations(cards.slice(i + 1), n - 1);
      for (const combo of tailCombos) {
        combinations.push([head, ...combo]);
      }
    }
    return combinations;
  }

  // Get numeric value for a hand for comparison
  getHandValue(evaluation, cards) {
    const sortedCards = cards.sort((a, b) => this.getRankValue(b.rank) - this.getRankValue(a.rank));
    const ranks = sortedCards.map(c => this.getRankValue(c.rank));
    
    // Base value from hand rank (higher is better)
    let value = evaluation.rank * 1000000;
    
    // Add high card values to break ties
    for (let i = 0; i < ranks.length; i++) {
      value += ranks[i] * Math.pow(100, 4 - i);
    }
    
    return value;
  }

  // Compare two hands and return winner
  compareHands(player1Hole, player2Hole, communityCards) {
    const hand1 = this.findBestHand(player1Hole, communityCards);
    const hand2 = this.findBestHand(player2Hole, communityCards);
    
    if (hand1.value > hand2.value) return 1;
    if (hand2.value > hand1.value) return 2;
    return 0; // Tie
  }

  // Determine winner at showdown
  determineWinner(activePlayers, communityCards) {
    if (activePlayers.length === 1) {
      return { winner: activePlayers[0], winners: [activePlayers[0]] };
    }

    let bestPlayers = [activePlayers[0]];
    let bestHand = this.findBestHand(activePlayers[0].holeCards, communityCards);

    for (let i = 1; i < activePlayers.length; i++) {
      const currentHand = this.findBestHand(activePlayers[i].holeCards, communityCards);
      
      if (currentHand.value > bestHand.value) {
        bestPlayers = [activePlayers[i]];
        bestHand = currentHand;
      } else if (currentHand.value === bestHand.value) {
        bestPlayers.push(activePlayers[i]);
      }
    }

    return { 
      winner: bestPlayers[0], 
      winners: bestPlayers,
      bestHand: bestHand.evaluation.name
    };
  }
}

module.exports = PokerGame;
