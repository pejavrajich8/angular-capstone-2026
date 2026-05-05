import { Component } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface SpinResult {
  isWin: boolean;
  amount: number;
  symbols: string;
  tier: 'jackpot' | 'partial' | 'loss';
}

@Component({
  selector: 'app-tab3',
  standalone: true,
  templateUrl: 'tab3.page.html',
  styleUrl: 'tab3.scss',
  imports: [
    IonHeader, 
    IonToolbar,
    IonTitle, 
    IonContent, 
    IonButtons, 
    IonButton,
    FormsModule,
    CommonModule
  ],
})
export class Tab3Page {
  symbols: string[] = ['🍎', '🍊', '🍋', '🍌', '🍇', '🍓'];
  displaySymbols: [string, string, string] = ['🍎', '🍎', '🍎'];
  betAmount: number = 10;
  spinResult: SpinResult | null = null;
  balance: number = 1000; 
  isSpinning: boolean = false;

  private readonly Max_Spins: number = 50;
  private readonly SPIN_DURATIONS = [1200, 1600, 2000];

  get minBet(): number {
    return 1;
  }
  get maxBet(): number {
    return this.balance;
  }
  betChange() {
    this.betAmount = Math.max(this.minBet, Math.min(this.maxBet, this.betAmount || this.minBet));
  }

  spin() {
    if (this.isSpinning || this.balance < this.betAmount || this.betAmount <= 0) {
      return;
    }
    this.isSpinning = true;
    this.spinResult = null;
    this.balance -= this.betAmount;

    this.displaySymbols = [
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)]
    ];
  }

  private finishSpin(symbols: [string, string, string]) {
    const [r1, r2, r3] = symbols;
    const allMatch = r1 === r2 && r2 === r3;
    const twoMatch = r1 === r2 || r2 === r3 || r1 === r3;
 
    let winAmount = 0;
    let tier: SpinResult['tier'] = 'loss';
 
    if (allMatch) {
      winAmount = this.betAmount * 10;
      tier = 'jackpot';
    } else if (twoMatch) {
      winAmount = Math.floor(this.betAmount * 2);
      tier = 'partial';
    }
 
    this.balance += winAmount;
 
    this.spinResult = {
      isWin: winAmount > 0,
      amount: winAmount,
      symbols: `${r1} ${r2} ${r3}`,
      tier
    };
  }
}
