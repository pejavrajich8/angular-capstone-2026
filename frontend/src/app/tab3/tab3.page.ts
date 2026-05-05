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

  private readonly Max_Spins: number = 50;
  private readonly SPIN_DURATIONS = [1200, 1600, 2000];

  get minBet(): number {
    return 1;
  }
  get maxBet(): number {
    return this.balance;
  }
  spin() {
    if (this.balance < this.betAmount) {
      return;
    }

    this.displaySymbols = [
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)]
    ];
  }

}
