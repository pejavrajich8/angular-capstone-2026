/**
 * SLOTS GAME INTEGRATION EXAMPLE
 * 
 * This shows how the Tab3Page (Slots Game) integrates with the CurrencyService
 * 
 * Key features:
 * - Load balance on init
 * - Deduct currency when placing bet
 * - Add currency when winning
 * - Real-time balance updates
 */

import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';
import { CurrencyPipe } from '@angular/common';
import { CurrencyService } from '../services/currency.service';
import { CurrencyDisplayComponent } from '../components/currency-display/currency-display.component';

interface SpinResult {
  isWin: boolean;
  amount: number;
  symbols: string;
  tier: 'jackpot' | 'partial' | 'loss';
}

@Component({
  selector: 'app-slots-example',
  standalone: true,
  template: `
    <!-- Header with currency display -->
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Slots Game</ion-title>
        <ion-buttons slot="end">
          <app-currency-display></app-currency-display>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <!-- Betting controls -->
      <div class="betting-section">
        <div>
          <label>Bet Amount: </label>
          <input 
            type="number" 
            [(ngModel)]="betAmount"
            (change)="betChange()"
            [min]="minBet"
            [max]="maxBet"
            [disabled]="isSpinning"
          />
        </div>
        <button (click)="spin()" [disabled]="isSpinning || balance < betAmount">
          {{ isSpinning ? 'Spinning...' : 'SPIN' }}
        </button>
      </div>

      <!-- Slots reels display -->
      <div class="slots-display">
        <div *ngFor="let symbol of displaySymbols" class="reel">
          {{ symbol }}
        </div>
      </div>

      <!-- Result message -->
      <div *ngIf="spinResult" class="result">
        <h3 [ngClass]="spinResult.isWin ? 'win' : 'loss'">
          {{ spinResult.isWin ? '🎉 WIN!' : '❌ LOSS' }}
        </h3>
        <p>{{ spinResult.symbols }}</p>
        <p *ngIf="spinResult.amount > 0">+{{ spinResult.amount }} coins!</p>
      </div>

      <!-- Current balance -->
      <div class="balance">
        <p>Balance: {{ balance }}</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .betting-section {
      padding: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .slots-display {
      display: flex;
      justify-content: center;
      gap: 20px;
      padding: 40px 20px;
    }

    .reel {
      width: 80px;
      height: 80px;
      border: 2px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      border-radius: 8px;
      background: #f0f0f0;
    }

    .result {
      text-align: center;
      padding: 20px;
      margin: 20px;
      border-radius: 8px;
      background: #f9f9f9;
    }

    .result.win {
      color: green;
      background: #e8f5e9;
    }

    .result.loss {
      color: red;
      background: #ffebee;
    }

    .balance {
      text-align: center;
      font-size: 1.2rem;
      font-weight: bold;
      padding: 20px;
    }
  `]
})
export class SlotsGameExampleComponent implements OnInit {
  symbols: string[] = ['🍊', '🍋', '🔔', '💎', '🍀'];
  displaySymbols: [string, string, string] = ['🍊', '🍊', '🍊'];
  betAmount: number = 10;
  spinResult: SpinResult | null = null;
  balance: number = 0;
  isSpinning: boolean = false;

  constructor(private currencyService: CurrencyService) {}

  ngOnInit() {
    // Load balance from Firebase
    this.balance = this.currencyService.getCurrentBalance();
    
    // Subscribe to balance updates
    this.currencyService.currency$.subscribe(newBalance => {
      this.balance = newBalance;
    });
  }

  get minBet(): number {
    return 1;
  }

  get maxBet(): number {
    return this.balance;
  }

  betChange() {
    this.betAmount = Math.max(this.minBet, Math.min(this.maxBet, this.betAmount || this.minBet));
  }

  async spin() {
    if (this.isSpinning || this.balance < this.betAmount || this.betAmount <= 0) {
      return;
    }

    // Deduct bet from Firebase
    const success = await this.currencyService.spendCurrency(this.betAmount, 'slots_bet');
    if (!success) {
      console.error('Failed to place bet');
      return;
    }

    this.isSpinning = true;
    this.spinResult = null;

    // Generate random symbols
    const finalSymbols: [string, string, string] = [
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)]
    ];

    // Animate for 2 seconds
    const animationDuration = 2000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed < animationDuration) {
        // Show random symbols during spin
        this.displaySymbols = [
          this.symbols[Math.floor(Math.random() * this.symbols.length)],
          this.symbols[Math.floor(Math.random() * this.symbols.length)],
          this.symbols[Math.floor(Math.random() * this.symbols.length)]
        ];
        requestAnimationFrame(animate);
      } else {
        // Stop on final symbols
        this.displaySymbols = finalSymbols;
        this.finishSpin(finalSymbols);
      }
    };

    requestAnimationFrame(animate);
  }

  private async finishSpin(symbols: [string, string, string]) {
    const [r1, r2, r3] = symbols;
    const allMatch = r1 === r2 && r2 === r3;
    const twoMatch = r1 === r2 || r2 === r3 || r1 === r3;

    let winAmount = 0;
    let tier: SpinResult['tier'] = 'loss';

    if (allMatch) {
      winAmount = this.betAmount * 10; // 10x multiplier for all match
      tier = 'jackpot';
    } else if (twoMatch) {
      winAmount = Math.floor(this.betAmount * 2); // 2x multiplier for two match
      tier = 'partial';
    }

    // Add winnings to Firebase if player won
    if (winAmount > 0) {
      await this.currencyService.addCurrency(winAmount, 'slots_win');
    }

    this.spinResult = {
      isWin: winAmount > 0,
      amount: winAmount,
      symbols: `${r1} ${r2} ${r3}`,
      tier
    };
    
    this.isSpinning = false;
  }
}
