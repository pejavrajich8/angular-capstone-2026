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
  selector: 'app-tab3',
  standalone: true,
  templateUrl: 'tab3.page.html',
  styleUrl: 'tab3.scss',
  imports: [
    CommonModule,
    IonHeader, 
    IonToolbar,
    IonTitle, 
    IonContent, 
    IonButtons, 
    IonButton,
    FormsModule,
    LogoutButtonComponent,
    CurrencyPipe,
    CurrencyDisplayComponent,
  ],
})
export class Tab3Page implements OnInit {
  symbols: string[] = ['big-P.png', '🍊', '🍋', '🔔', '💎', '🍀'];
  displaySymbols: [string, string, string] = ['big-P.png', 'big-P.png', 'big-P.png'];
  betAmount: number = 10;
  spinResult: SpinResult | null = null;
  balance: number = 0;
  isSpinning: boolean = false;
  image: HTMLImageElement = (() => {
    const img = new Image();
    img.src = 'frontend/public/icons/big-P.png';
    return img;
  })();

  private readonly Max_Spins: number = 50;
  private readonly SPIN_DURATIONS = [1200, 1600, 2000];

  constructor(
    private sanitizer: DomSanitizer,
    private currencyService: CurrencyService
  ) {}

  ngOnInit() {
    // Load user's balance from Firebase
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

    const finalSymbols: [string, string, string] = [
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)]
    ];

    // Animate each reel stopping at different times
    this.animateReel(0, finalSymbols[0], this.SPIN_DURATIONS[0]);
    this.animateReel(1, finalSymbols[1], this.SPIN_DURATIONS[1]);
    this.animateReel(2, finalSymbols[2], this.SPIN_DURATIONS[2], () => {
      this.finishSpin(finalSymbols);
    });
  }

  private animateReel(
    index: 0 | 1 | 2,
    finalSymbol: string,
    duration: number,
    onComplete?: () => void
  ) {
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        // Show random symbol while spinning
        this.displaySymbols[index] = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        requestAnimationFrame(tick);
      } else {
        // Snap to the final symbol
        this.displaySymbols[index] = finalSymbol;
        onComplete?.();
      }
    };

    requestAnimationFrame(tick);
  }

  private async finishSpin(symbols: [string, string, string]) {
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

  getSafeImageUrl(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

}

