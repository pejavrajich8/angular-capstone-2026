import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonSpinner,
} from '@ionic/angular/standalone';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';
import { CurrencyDisplayComponent } from '../components/currency-display/currency-display.component';
import { PokerService } from '../services/poker.service';
import { CurrencyService } from '../services/currency.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-tab2',
  templateUrl: './tab2.page.html',
  styleUrls: ['./tab2.page.css'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonCard,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonText,
    IonSpinner,
    LogoutButtonComponent,
    CurrencyDisplayComponent,
  ],
})
export class Tab2Page implements OnInit, OnDestroy {
  tableId: string = '';
  playerName: string = 'Player 1';
  gameState: any = null;
  isPlayerTurn: boolean = false;
  legalActions: string[] = [];
  messages: string = '';
  isLoading: boolean = false;
  gameStarted: boolean = false;
  raiseAmount: number = 0;
  demoChipsAmount: number = 5000;
  lastClaimTime: number = 0;
  canClaimChips: boolean = true;
  holeCards: any[] = [];
  handEndData: any = null;
  showWinnerModal: boolean = false;
  footerExpanded: boolean = false;
  bankroll: number = 0;
  private destroy$ = new Subject<void>();
  private initialized: boolean = false;
  private readonly buyIn = 1000;

  constructor(
    private pokerService: PokerService,
    private currencyService: CurrencyService,
    private location: Location,
    private auth: Auth
  ) {
    this.tableId = this.generateTableId();
    console.log('Generated tableId:', this.tableId);
  }

  ngOnInit() {
    // Bankroll is the user's shared currency balance.
    this.currencyService.getCurrencyObservable().subscribe((balance) => {
      this.bankroll = balance ?? 0;
      // Only initialize poker if user has money
      if (this.bankroll > 0 && !this.initialized) {
        this.initializePoker();
      }
    });
  }

  goBack() {
    this.location.back();
  }

  async topUpBalance() {
    await this.currencyService.addCurrency(1000, 'poker_topup');
  }

  private generateTableId(): string {
    return uuidv4().substring(0, 8);
  }

  ngOnDestroy() {
    // Refund whatever chips remain at the table back to the global balance
    const remaining = this.getPlayerStack();
    if (remaining > 0) {
      this.currencyService.addCurrency(remaining, 'poker_refund');
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.pokerService.disconnect();
  }

  async initializePoker() {
    if (this.initialized) return;
    this.initialized = true;
    this.isLoading = true;

    // Check balance before doing anything
    if (this.bankroll < this.buyIn) {
      this.messages = `Need $${this.buyIn} to buy in. Current balance: $${this.bankroll}.`;
      this.isLoading = false;
      this.initialized = false;
      return;
    }

    let buyInDeducted = false;
    try {
      // Connect first — if this fails we haven't touched money yet
      await this.pokerService.connect();

      // Wire up subscriptions
      this.pokerService.getGameState$().pipe(takeUntil(this.destroy$)).subscribe(s => this.gameState = s);
      this.pokerService.getPlayerTurn$().pipe(takeUntil(this.destroy$)).subscribe(t => this.isPlayerTurn = t);
      this.pokerService.getLegalActions$().pipe(takeUntil(this.destroy$)).subscribe(a => this.legalActions = a);
      this.pokerService.getMessages$().pipe(takeUntil(this.destroy$)).subscribe(m => this.messages = m);
      this.pokerService.getHoleCards$().pipe(takeUntil(this.destroy$)).subscribe(c => this.holeCards = c);
      this.pokerService.getHandEnd$().pipe(takeUntil(this.destroy$)).subscribe(d => this.onHandEnd(d));

      // Deduct buy-in only after connection is confirmed
      const bought = await this.currencyService.spendCurrency(this.buyIn, 'poker_buyin');
      if (!bought) {
        this.messages = `Need $${this.buyIn} to buy in.`;
        this.initialized = false;
        return;
      }
      buyInDeducted = true;

      const firebaseUid = this.auth.currentUser?.uid;
      if (!firebaseUid) throw new Error('User not authenticated');

      await this.pokerService.joinGame(this.tableId, this.playerName, firebaseUid);
      this.messages = 'Joined poker table!';
      await this.startGame();
    } catch (error) {
      console.error('Error initializing poker:', error);
      this.messages = `Connection failed: ${error}`;
      // Refund buy-in if we deducted it but the game never started
      if (buyInDeducted) {
        await this.currencyService.addCurrency(this.buyIn, 'poker_buyin_refund');
      }
      this.initialized = false;
    } finally {
      this.isLoading = false;
    }
  }

  async startGame() {
    try {
      this.isLoading = true;
      console.log('Starting game with tableId:', this.tableId);
      await this.pokerService.startGame(this.tableId);
      console.log('Game started successfully');
      this.gameStarted = true;
      this.messages = 'Game started!';
    } catch (error) {
      console.error('Error starting game:', error);
      this.messages = `Error: ${error}`;
    } finally {
      this.isLoading = false;
    }
  }

  async playerAction(action: string) {
    try {
      const player = this.getPlayerInfo();
      if (!player) return;
      
      // Prevent stack from going below 0
      if (player.chipStack <= 0) {
        this.messages = 'Insufficient chips!';
        return;
      }
      
      this.isLoading = true;
      const amount = action === 'raise' ? this.raiseAmount : 0;
      
      // Validate raise amount doesn't exceed stack
      if (action === 'raise' && amount > player.chipStack) {
        this.messages = 'Raise amount exceeds your stack!';
        this.isLoading = false;
        return;
      }
      
      await this.pokerService.playerAction(this.tableId, action, amount);
      this.raiseAmount = 0;
    } catch (error) {
      console.error('Error performing action:', error);
      this.messages = `Error: ${error}`;
    } finally {
      this.isLoading = false;
    }
  }

  async claimDemoChips() {
    try {
      this.isLoading = true;
      await this.pokerService.claimDemoChips(this.tableId);
      this.messages = `You claimed $${this.demoChipsAmount} demo chips!`;
      this.canClaimChips = false;
      
      // Allow claiming again after 30 seconds
      setTimeout(() => {
        this.canClaimChips = true;
      }, 30000);
    } catch (error) {
      console.error('Error claiming chips:', error);
      this.messages = `Error: ${error}`;
    } finally {
      this.isLoading = false;
    }
  }

  getPlayerInfo() {
    if (!this.gameState) return null;
    return this.gameState.players.find((p: any) => p.id === this.pokerService.mySocketId);
  }

  getOtherPlayers() {
    if (!this.gameState) return [];
    return this.gameState.players.filter((p: any) => p.id !== this.pokerService.mySocketId);
  }

  getAmountToCall(): number {
    const player = this.getPlayerInfo();
    if (!player || !this.gameState) return 0;
    return Math.max(0, this.gameState.currentBet - player.currentBet);
  }

  getTotalBet(): number {
    const player = this.getPlayerInfo();
    return player?.currentBet || 0;
  }

  getPlayerStack(): number {
    const player = this.getPlayerInfo();
    return player?.chipStack || 0;
  }

  getPotAmount(): number {
    return this.gameState?.pot || 0;
  }

  toggleFooter() {
    this.footerExpanded = !this.footerExpanded;
  }

  onHandEnd(data: any) {
    this.handEndData = data;
    this.showWinnerModal = true;

    // Credit winnings to global balance if this player won
    const myId = this.pokerService.mySocketId;
    const iWon = data.winnerIds
      ? data.winnerIds.includes(myId)
      : data.winnerId === myId;

    if (iWon) {
      const payout = data.splitAmount ?? data.winAmount ?? 0;
      if (payout > 0) {
        this.currencyService.addCurrency(payout, 'poker_win');
      }
    }

    setTimeout(() => {
      this.showWinnerModal = false;
      this.handEndData = null;
      this.startGame();
    }, 3000);
  }
}
