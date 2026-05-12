class BotAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty; // easy, medium, hard
  }

  shouldFold(player, currentBet, pot, communityCards) {
    const foldThreshold = this.getFoldThreshold();
    const handStrength = this.evaluateHandStrength(player.holeCards, communityCards);
    const potOdds = this.calculatePotOdds(player, currentBet, pot);
    const chipStackRatio = player.chipStack / 1000; // Normalized to starting chips

    if (this.difficulty === 'easy') {
      return Math.random() < 0.4 && handStrength < 0.3;
    }

    // Fold if hand is weak and pot odds don't justify calling
    if (handStrength < foldThreshold) {
      // If low on chips, be more aggressive with marginal hands
      if (chipStackRatio < 0.5 && handStrength > 0.2) {
        return false; // Play tight with short stack
      }
      return potOdds < handStrength * 2;
    }

    return false;
  }

  shouldCall(player, currentBet, communityCards) {
    if (player.currentBet >= currentBet) return false;

    const handStrength = this.evaluateHandStrength(player.holeCards, communityCards);
    const callThreshold = this.getCallThreshold();
    const callAmount = currentBet - player.currentBet;
    const chipStackRatio = player.chipStack / 1000;

    if (this.difficulty === 'easy') {
      return Math.random() < 0.6;
    }

    // If very short on chips, be tighter
    if (chipStackRatio < 0.3 && handStrength < 0.6) {
      return false;
    }

    // If call amount is large relative to stack, need stronger hand
    if (callAmount > player.chipStack * 0.3 && handStrength < callThreshold + 0.1) {
      return false;
    }

    return handStrength > callThreshold;
  }

  shouldRaise(player, currentBet, pot, communityCards) {
    const handStrength = this.evaluateHandStrength(player.holeCards, communityCards);
    const raiseThreshold = this.getRaiseThreshold();
    const amountToCall = currentBet - player.currentBet;
    const chipStackRatio = player.chipStack / 1000;

    if (this.difficulty === 'easy') {
      return Math.random() < 0.15 && handStrength > 0.6 ? 100 : false;
    }

    if (handStrength > raiseThreshold) {
      // Scale raise based on hand strength
      let raiseAmount = Math.floor((pot + amountToCall) * (0.25 + handStrength * 0.35));
      
      // Adjust for stack size - don't put all chips in unless going all-in makes sense
      const maxRaise = Math.floor(player.chipStack * 0.7);
      raiseAmount = Math.min(raiseAmount, maxRaise);

      // If very strong hand and good stack, raise more
      if (handStrength > 0.8 && chipStackRatio > 1) {
        raiseAmount = Math.floor(raiseAmount * 1.2);
      }

      return raiseAmount > 0 ? raiseAmount : false;
    }

    // Sometimes bluff with medium strength hands if short-stacked
    if (chipStackRatio < 0.4 && handStrength > 0.45 && Math.random() < 0.2) {
      return Math.floor(Math.min(pot * 0.15, player.chipStack * 0.5));
    }

    return false;
  }

  evaluateHandStrength(holeCards, communityCards) {
    if (holeCards.length < 2) return 0;

    const rankValues = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };

    const rank1 = rankValues[holeCards[0].rank];
    const rank2 = rankValues[holeCards[1].rank];
    const isSuited = holeCards[0].suit === holeCards[1].suit;

    // Base strength from hole cards
    let strength = (rank1 + rank2) / 28;

    // Pair bonus (very strong starting hand)
    if (rank1 === rank2) {
      strength = 0.65 + (rank1 / 14) * 0.25;
    }

    // Broadway cards (10+) bonus
    if (rank1 >= 10 && rank2 >= 10) {
      strength += 0.15;
    }

    // Ace kicker bonus
    if ((rank1 === 14 || rank2 === 14) && (rank1 >= 10 || rank2 >= 10)) {
      strength += 0.1;
    }

    // Connector bonus (potential for straight)
    if (Math.abs(rank1 - rank2) === 1) {
      strength += 0.08;
    }

    // Suited bonus (potential for flush)
    if (isSuited) {
      strength += 0.1;
    }

    // Adjust based on community cards
    if (communityCards.length > 0) {
      const allCards = [...holeCards, ...communityCards];
      const communityRanks = communityCards.map(c => rankValues[c.rank]);

      // Check for made hands (significantly boost strength)
      if (this.hasTrips(allCards)) {
        strength = Math.max(strength, 0.85);
      } else if (this.hasStraight(allCards)) {
        strength = Math.max(strength, 0.78);
      } else if (this.hasFlush(allCards)) {
        strength = Math.max(strength, 0.75);
      }

      // Count overcards (potential improvement)
      const overcardsCount = communityRanks.filter(r => r > Math.max(rank1, rank2)).length;
      if (overcardsCount > 2 && strength < 0.4) {
        strength -= 0.1; // Weaken hand if many overcards
      }

      // Gap in hand strength adjustment
      if (communityCards.length === 5) {
        // At river, lock in the strength
        if (strength < 0.35) strength = Math.max(0.1, strength * 0.8);
      }
    }

    return Math.min(strength, 0.99);
  }

  hasFlush(cards) {
    const suits = cards.map(c => c.suit);
    const suitCounts = {};
    suits.forEach(s => (suitCounts[s] = (suitCounts[s] || 0) + 1));
    return Object.values(suitCounts).some(count => count >= 5);
  }

  hasStraight(cards) {
    const rankValues = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };

    const ranks = cards.map(c => rankValues[c.rank]).sort((a, b) => b - a);
    const uniqueRanks = [...new Set(ranks)];

    for (let i = 0; i < uniqueRanks.length - 4; i++) {
      if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
        return true;
      }
    }

    return false;
  }

  hasTrips(cards) {
    const ranks = cards.map(c => c.rank);
    const rankCounts = {};
    ranks.forEach(r => (rankCounts[r] = (rankCounts[r] || 0) + 1));
    return Object.values(rankCounts).some(count => count >= 3);
  }

  calculatePotOdds(player, currentBet, pot) {
    const callAmount = currentBet - player.currentBet;
    if (callAmount === 0) return Infinity;
    return pot / callAmount;
  }

  getFoldThreshold() {
    switch (this.difficulty) {
      case 'easy': return 0.3;
      case 'hard': return 0.25;
      case 'medium':
      default: return 0.35;
    }
  }

  getCallThreshold() {
    switch (this.difficulty) {
      case 'easy': return 0.3;
      case 'hard': return 0.45;
      case 'medium':
      default: return 0.4;
    }
  }

  getRaiseThreshold() {
    switch (this.difficulty) {
      case 'easy': return 0.7;
      case 'hard': return 0.55;
      case 'medium':
      default: return 0.65;
    }
  }

  makeDecision(game, player) {
    const legalActions = game.getLegalActions(player);
    const handStrength = this.evaluateHandStrength(player.holeCards, game.communityCards);

    // Add slight delay for realism
    const delay = Math.random() * 2000 + 500;

    // Priority: Raise > Call > Check > Fold
    
    if (legalActions.includes('raise')) {
      const raiseAmount = this.shouldRaise(player, game.currentBet, game.pot, game.communityCards);
      if (raiseAmount) {
        return {
          action: 'raise',
          amount: raiseAmount,
          delay,
        };
      }
    }

    if (legalActions.includes('call')) {
      const shouldCall = this.shouldCall(player, game.currentBet, game.communityCards);
      if (shouldCall) {
        return { action: 'call', delay };
      }
    }

    if (legalActions.includes('check')) {
      return { action: 'check', delay };
    }

    if (legalActions.includes('fold')) {
      const shouldFold = this.shouldFold(player, game.currentBet, game.pot, game.communityCards);
      if (shouldFold) {
        return { action: 'fold', delay };
      }
    }

    // Fallback decision logic
    if (legalActions.includes('call')) {
      return { action: 'call', delay };
    }

    if (legalActions.includes('check')) {
      return { action: 'check', delay };
    }

    // Last resort
    return { action: 'fold', delay };
  }
}

module.exports = BotAI;
