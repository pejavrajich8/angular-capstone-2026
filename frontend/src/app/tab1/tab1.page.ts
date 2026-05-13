import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
} from '@ionic/angular/standalone';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';
import { CurrencyService } from '../services/currency.service';

@Component({
  selector: 'app-tab1',
  standalone: true,
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.css'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, LogoutButtonComponent],
})
export class Tab1Page {
  deckId: string = '';
  dealerCards: any[] = [];
  playerCards: any[] = [];
  gameStarted: boolean = false;
  gameEnded: boolean = false;
  revealDealerHand: boolean = false;
  revealDealerScore: boolean = false;

  // Betting / bankroll
  bankroll: number = 0;
  currentBet: number = 0;
  private placedBet: number = 0;
  private readonly bankrollStorageKey = 'blackjack_bankroll';
  private autoNextRoundDelayMs = 1200;

  constructor(private http: HttpClient, private currencyService: CurrencyService) {}

  ngOnInit() {
    this.createDeck();
    this.loadBankroll();
  }

  private loadBankroll() {
    const raw = localStorage.getItem(this.bankrollStorageKey);
    const parsed = raw ? Number(raw) : NaN;

    // Starting money = $1000
    this.bankroll = Number.isFinite(parsed) ? parsed : 1000;
    this.saveBankroll();
  }

  private saveBankroll() {
    localStorage.setItem(this.bankrollStorageKey, String(this.bankroll));
  }

  addToBet(amount: number) {
    if (amount <= 0) return;
    if (this.bankroll <= 0) return;

  const updated = this.currentBet + amount;
  if (updated > this.bankroll) return;

  this.currentBet = updated;
  }

  clearBet() {
    this.currentBet = 0;
  }

  placeBetAndStart() {
    if (this.gameStarted) return;
    if (this.currentBet <= 0) return;
    if (this.currentBet > this.bankroll) return;

  // Lock the bet for this hand.
  this.placedBet = this.currentBet;
    this.startRound();
  }

  resettothousand(){
    // Reset both the local blackjack bankroll and the shared (Firestore-backed) currency balance.
    // This keeps the header currency + slots currency consistent across the app.
    this.bankroll = 1000;
    this.currentBet = 0;
    this.placedBet = 0;
    this.saveBankroll();

    // Set Firestore balance to exactly 1000.
    // We do this via a "delta" so we don't need a new API in CurrencyService.
    const current = this.currencyService.getCurrentBalance();
    const diff = 1000 - current;
    if (diff !== 0) {
      // Positive diff => addCurrency, negative diff => spendCurrency
      if (diff > 0) {
        this.currencyService.addCurrency(diff, 'blackjack_reset');
      } else {
        this.currencyService.spendCurrency(Math.abs(diff), 'blackjack_reset');
      }
    }
  }

  quitGame() {
    // Return to the pre-round screen.
    this.resetRoundState();
  }

  private scheduleNextRound() {
    if (this.bankroll <= 0) {
      // Out of money: return to the pre-round screen.
      this.resetRoundState();
      return;
    }
    if (this.currentBet <= 0) {
      this.currentBet = 10;
    }
    if (this.currentBet > this.bankroll) {
      // Can't afford the current bet anymore. Go back to pre-round so they can choose.
      this.resetRoundState();
      return;
    }

    setTimeout(() => {
      this.startRound();
    }, this.autoNextRoundDelayMs);
  }

  private resetRoundState() {
    this.dealerCards = [];
    this.playerCards = [];
    this.gameStarted = false;
    this.gameEnded = false;
    this.revealDealerHand = false;
    this.revealDealerScore = false;
  }

  private startRound() {
    // Clear old hands / UI flags
    this.dealerCards = [];
    this.playerCards = [];
    this.gameEnded = false;
    this.revealDealerHand = false;
    this.revealDealerScore = false;

    // If we auto-started the round, lock whatever the current bet is.
    if (this.placedBet <= 0) {
      this.placedBet = this.currentBet;
    }

    const beginDraws = () => {
      this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=1`)
        .subscribe((data: any) => {
          this.dealerCards = data.cards;

          this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=2`)
            .subscribe((playerData: any) => {
              this.playerCards = playerData.cards;
              this.gameStarted = true;
            });
        });
    };

    // Make sure we have a deck id before drawing.
    if (!this.deckId) {
      this.http.get(`${environment.apiBaseUrl}/api/deck/create`).subscribe((data: any) => {
        this.deckId = data.deck_id;
        beginDraws();
      });
      return;
    }

    beginDraws();
  }

  getHandValue(cards: any[]): number {
    let value = 0;
    let aces = 0;

    for (let card of cards) {
      const rank = card.value;

      if (rank === 'ACE') {
        aces += 1;
        value += 11;
      } else if (['KING', 'QUEEN', 'JACK'].includes(rank)) {
        value += 10;
      } else {
        value += parseInt(rank);
      }
    }

    // Adjust for aces
    while (value > 21 && aces > 0) {
      value -= 10;
      aces -= 1;
    }

    return value;
  }

  createDeck() {
  this.http.get(`${environment.apiBaseUrl}/api/deck/create`).subscribe((data: any) => {
      console.log('New deck:', data);
      this.deckId = data.deck_id;
    });
  }

  drawCards() {
    // Back-compat: treat the old Start Game button as "start with current bet".
    // If no bet was chosen, default to $10.
    if (this.currentBet <= 0) {
      this.currentBet = 10;
    }
    this.placeBetAndStart();
  }

  hitMe() {
    this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=1`)
      .subscribe((data: any) => {
        console.log('New card:', data.cards[0]);
        this.playerCards.push(data.cards[0]);

        // Wait 1.5 seconds before checking for bust
        setTimeout(() => {
          // Check if player busted
          const playerValue = this.getHandValue(this.playerCards);
          console.log('Player hand value:', playerValue);

          if (playerValue > 21) {
            this.gameEnded = true;
            this.revealDealerHand = true;
            this.revealDealerScore = true;

            const loss = this.placedBet > 0 ? this.placedBet : this.currentBet;
            this.placedBet = 0;
            this.bankroll = Math.max(0, this.bankroll - loss);
            this.saveBankroll();

            alert('You Lose! Hand value: ' + playerValue);
            this.scheduleNextRound();
          }
        }, 500);
      });
  }

  stand() {
    const playerValue = this.getHandValue(this.playerCards);
    console.log('Player stands with value:', playerValue);

  // Reveal dealer's full hand now that the player has stood.
  this.revealDealerHand = true;
    this.revealDealerScore = false;
    setTimeout(() => {
      this.revealDealerScore = true;
    }, 1000);

    // Dealer keeps drawing until 17 or higher
    const dealerDrawLoop = () => {
      const dealerValue = this.getHandValue(this.dealerCards);
      console.log('Dealer hand value:', dealerValue);

      if (dealerValue < 17) {
        // Dealer draws another card
        this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=1`)
          .subscribe((data: any) => {
            this.dealerCards.push(data.cards[0]);
            // Slow down the dealer so the user can see each card arrive.
            setTimeout(() => {
              dealerDrawLoop();
            }, 1000);
          });
      } else {
        // Dealer stands, determine winner
        this.determineWinner(playerValue, dealerValue);
      }
    };

    dealerDrawLoop();
  }

  determineWinner(playerValue: number, dealerValue: number) {
    console.log('Final - Player:', playerValue, 'Dealer:', dealerValue);
    this.gameEnded = true;
  this.revealDealerHand = true;
  this.revealDealerScore = true;

  // Update bankroll only when the hand ends.
  // IMPORTANT: use `placedBet` (the bet at hand start), not `currentBet`.
  let delta = 0;
    let message = '';

    if (dealerValue > 21) {
      delta = this.placedBet;
      message = `Dealer Busted! You Win! Dealer: ${dealerValue}, You: ${playerValue}`;
    } else if (playerValue > dealerValue) {
      delta = this.placedBet;
      message = `You Win! Dealer: ${dealerValue}, You: ${playerValue}`;
    } else if (playerValue === dealerValue) {
      delta = 0;
      message = `Push (Tie)! Both have: ${playerValue}`;
    } else {
      // Loss subtracts the last/placed bet for this finished hand.
      delta = -this.placedBet;
      message = `You Lose! Dealer: ${dealerValue}, You: ${playerValue}`;
    }

    // Clear placedBet so the next hand re-locks cleanly.
    this.placedBet = 0;

    this.bankroll = Math.max(0, this.bankroll + delta);
    this.saveBankroll();

    alert(message);

  // Automatically proceed to the next round.
  this.scheduleNextRound();
  }
}