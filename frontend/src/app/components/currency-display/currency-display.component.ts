import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { walletOutline } from 'ionicons/icons';
import { CurrencyService } from '../../services/currency.service';

@Component({
  selector: 'app-currency-display',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="currency-display">
      <ion-icon name="wallet-outline"></ion-icon>
      <span class="currency-amount">{{ (currencyService.currency$ | async) || 0 }}</span>
    </div>
  `,
  styles: [`
    .currency-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: white;
      font-weight: bold;
      font-size: 1.1rem;
    }

    ion-icon {
      font-size: 1.5rem;
    }

    .currency-amount {
      min-width: 50px;
      text-align: center;
    }
  `]
})
export class CurrencyDisplayComponent implements OnInit {
  constructor(public currencyService: CurrencyService) {
    addIcons({ walletOutline });
  }

  ngOnInit() {
    // Currency is automatically loaded via CurrencyService
  }
}
