import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { PokerService } from '../services/poker.service';
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
  bankroll: number = 1000;
  private bankrollStorageKey = 'poker_bankroll';
  private destroy$ = new Subject<void>();
  private initialized: boolean = false;

  constructor(private pokerService: PokerService) {
    this.tableId = this.generateTableId();
    console.log('Generated tableId:', this.tableId);
  }

  ngOnInit() {
    this.loadBankroll();
    this.initializePoker();
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

  private generateTableId(): string {
    return uuidv4().substring(0, 8);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.pokerService.disconnect();
  }

  async initializePoker() {
    try {
      // Only initialize once
      if (this.initialized) {
        return;
      }
      this.initialized = true;
      this.isLoading = true;
      console.log('Initializing poker with tableId:', this.tableId);

      // Connect to WebSocket
      await this.pokerService.connect();
      console.log('Connected to poker service');

      // Subscribe to game state updates
      this.pokerService
        .getGameState$()
        .pipe(takeUntil(this.destroy$))
        .subscribe((state) => {
          this.gameState = state;
        });

      // Subscribe to player turn
      this.pokerService
        .getPlayerTurn$()
        .pipe(takeUntil(this.destroy$))
        .subscribe((isTurn) => {
          this.isPlayerTurn = isTurn;
        });

      // Subscribe to legal actions
      this.pokerService
        .getLegalActions$()
        .pipe(takeUntil(this.destroy$))
        .subscribe((actions) => {
          this.legalActions = actions;
        });

      // Subscribe to messages
      this.pokerService
        .getMessages$()
        .pipe(takeUntil(this.destroy$))
        .subscribe((msg) => {
          this.messages = msg;
        });

      // Subscribe to hole cards
      this.pokerService
        .getHoleCards$()
        .pipe(takeUntil(this.destroy$))
        .subscribe((cards) => {
          this.holeCards = cards;
        });

      // Subscribe to hand end
      this.pokerService
        .getHandEnd$()
        .pipe(takeUntil(this.destroy$))
        .subscribe((data) => {
          this.handEndData = data;
          this.showWinnerModal = true;
          setTimeout(() => {
            this.showWinnerModal = false;
            this.handEndData = null;
            this.startGame(); // Restart the game
          }, 3000);
        });

      // Join the game
      await this.pokerService.joinGame(this.tableId, this.playerName);
      console.log('Joined game, tableId:', this.tableId);
      this.messages = 'Joined poker table!';
      
      // Start the game automatically
      await this.startGame();
    } catch (error) {
      console.error('Error initializing poker:', error);
      this.messages = `Error: ${error}`;
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
    return this.gameState.players.find((p: any) => p.id === (this.pokerService as any).socket?.id);
  }

  getOtherPlayers() {
    if (!this.gameState) return [];
    return this.gameState.players.filter((p: any) => p.id !== (this.pokerService as any).socket?.id);
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
}
