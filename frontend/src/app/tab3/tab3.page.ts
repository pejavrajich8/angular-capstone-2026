import { Component, OnInit } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrl: 'tab3.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    FormsModule,
    CommonModule,
    IonButton,
    CurrencyPipe
  ],
})
export class Tab3Page implements OnInit {
  balance: number = 1000;
  betAmount: number = 10;
  isSpinning: boolean = false;
  reel1Offset: number = 0;
  reel2Offset: number = 0;
  reel3Offset: number = 0;
  reelSymbols: string[] = ['🍎', '🍊', '🍋', '🍌', '🍇', '🍓'];
  lastResult: any = null;
  spinHistory: any[] = [];

  ngOnInit() {
    // Initialize component
  }

  onBetChange() {
    // Handle bet amount changes
  }

  spin() {
    if (this.isSpinning || this.balance < this.betAmount) {
      return;
    }

    this.isSpinning = true;
    this.balance -= this.betAmount;

    // Animate reels
    const spinDuration = 2000; // 2 seconds
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Fast spinning animation
      this.reel1Offset = -progress * 600;
      this.reel2Offset = -progress * 600;
      this.reel3Offset = -progress * 600;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.finishSpin();
      }
    };

    requestAnimationFrame(animate);
  }

  private finishSpin() {
    // Generate random results
    const reel1 = this.reelSymbols[Math.floor(Math.random() * this.reelSymbols.length)];
    const reel2 = this.reelSymbols[Math.floor(Math.random() * this.reelSymbols.length)];
    const reel3 = this.reelSymbols[Math.floor(Math.random() * this.reelSymbols.length)];

    // Check if win
    const isWin = reel1 === reel2 && reel2 === reel3;
    const winAmount = isWin ? this.betAmount * 10 : 0;

    if (isWin) {
      this.balance += winAmount;
    }

    this.lastResult = {
      isWin,
      amount: winAmount,
      symbols: `${reel1} ${reel2} ${reel3}`
    };

    // Add to history
    this.spinHistory.unshift(this.lastResult);

    this.isSpinning = false;
  }
}
