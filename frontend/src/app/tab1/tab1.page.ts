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

@Component({
  selector: 'app-tab1',
  standalone: true,
  templateUrl: 'tab1.page.html',
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton],
})
export class Tab1Page {
  deckId: string = '';
  dealerCards: any[] = [];
  playerCards: any[] = [];
  gameStarted: boolean = false;
  gameEnded: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.createDeck();
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
    // Draw 2 cards for dealer
    this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=2`)
      .subscribe((data: any) => {
        console.log('Dealer cards:', data.cards);
        this.dealerCards = data.cards;

        // Draw 2 cards for player
        this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=2`)
          .subscribe((playerData: any) => {
            console.log('Player cards:', playerData.cards);
            this.playerCards = playerData.cards;
            this.gameStarted = true;
            console.log('Game started - Dealer:', this.dealerCards, 'Player:', this.playerCards);
          });
      });
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
            alert('You Lose! Hand value: ' + playerValue);
            location.reload();
          }
        }, 500);
      });
  }

  stand() {
    const playerValue = this.getHandValue(this.playerCards);
    console.log('Player stands with value:', playerValue);

    // Dealer keeps drawing until 17 or higher
    const dealerDrawLoop = () => {
      const dealerValue = this.getHandValue(this.dealerCards);
      console.log('Dealer hand value:', dealerValue);

      if (dealerValue < 17) {
        // Dealer draws another card
        this.http.get(`${environment.apiBaseUrl}/api/deck/draw?deckId=${this.deckId}&count=1`)
          .subscribe((data: any) => {
            this.dealerCards.push(data.cards[0]);
            dealerDrawLoop();
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

    if (dealerValue > 21) {
      alert('Dealer Busted! You Win! Dealer: ' + dealerValue + ', You: ' + playerValue);
    } else if (playerValue > dealerValue) {
      alert('You Win! Dealer: ' + dealerValue + ', You: ' + playerValue);
    } else if (playerValue === dealerValue) {
      alert('Push (Tie)! Both have: ' + playerValue);
    } else {
      alert('You Lose! Dealer: ' + dealerValue + ', You: ' + playerValue);
    }

    location.reload();
  }
}