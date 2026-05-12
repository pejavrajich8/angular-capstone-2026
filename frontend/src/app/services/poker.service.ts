import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class PokerService {
  private socket: Socket | null = null;
  private gameState$ = new BehaviorSubject<any>(null);
  private playerTurn$ = new BehaviorSubject<boolean>(false);
  private legalActions$ = new BehaviorSubject<string[]>([]);
  private messages$ = new BehaviorSubject<string>('');
  private holeCards$ = new BehaviorSubject<any[]>([]);
  private handEnd$ = new Subject<any>();

  constructor(private ngZone: NgZone) {}

  connect(backendUrl: string = 'http://localhost:3333'): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.socket && this.socket.connected) {
        resolve();
        return;
      }

      this.socket = io(backendUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        console.log('Connected to poker server');
        resolve();
      });

      this.socket.on('gameStateUpdate', (state) => {
        this.ngZone.run(() => {
          this.gameState$.next(state);
        });
      });

      this.socket.on('awaitingAction', (data) => {
        this.ngZone.run(() => {
          this.playerTurn$.next(true);
          this.legalActions$.next(data.legalActions);
          this.messages$.next(`Your turn! Legal actions: ${data.legalActions.join(', ')}`);
        });
      });

      this.socket.on('holeCards', (cards) => {
        this.ngZone.run(() => {
          this.holeCards$.next(cards);
        });
      });

      this.socket.on('handEnd', (data) => {
        this.ngZone.run(() => {
          this.playerTurn$.next(false);
          this.messages$.next(`Hand ended. ${data.winner} won $${data.winAmount}! Hand: ${data.handType}`);
          this.handEnd$.next(data);
        });
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from poker server');
        this.playerTurn$.next(false);
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  joinGame(tableId: string, playerName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('Joining game:', { tableId, playerName });
      this.socket.emit('joinGame', { tableId, playerName }, (response: any) => {
        console.log('Join game response:', response);
        if (response.success) {
          resolve(response.game);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  startGame(tableId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('Starting game:', { tableId });
      this.socket.emit('startGame', { tableId }, (response: any) => {
        console.log('Start game response:', response);
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  playerAction(tableId: string, action: string, amount: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('playerAction', { tableId, action, amount }, (response: any) => {
        if (response.success) {
          this.ngZone.run(() => {
            this.playerTurn$.next(false);
            this.messages$.next(`You ${action}${amount > 0 ? ' ' + amount : ''}`);
          });
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  claimDemoChips(tableId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('claimDemoChips', { tableId }, (response: any) => {
        if (response.success) {
          this.ngZone.run(() => {
            this.gameState$.next(response.gameState);
            this.messages$.next('Demo chips claimed!');
          });
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getGameState$(): Observable<any> {
    return this.gameState$.asObservable();
  }

  getPlayerTurn$(): Observable<boolean> {
    return this.playerTurn$.asObservable();
  }

  getLegalActions$(): Observable<string[]> {
    return this.legalActions$.asObservable();
  }

  getMessages$(): Observable<string> {
    return this.messages$.asObservable();
  }

  getHoleCards$(): Observable<any[]> {
    return this.holeCards$.asObservable();
  }

  getHandEnd$(): Observable<any> {
    return this.handEnd$.asObservable();
  }
}
