import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserCurrency {
  uid: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: any;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private currencySubject = new BehaviorSubject<number>(0);
  public currency$ = this.currencySubject.asObservable();

  constructor(private auth: Auth, private firestore: Firestore) {
    this.initializeCurrencyListener();
  }

  /**
   * Initialize real-time listener for current user's currency balance
   */
  private initializeCurrencyListener() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.loadCurrencyBalance(user.uid);
      } else {
        this.currencySubject.next(0);
      }
    });
  }

  /**
   * Load the current user's currency balance
   */
  async loadCurrencyBalance(uid: string): Promise<number> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserCurrency;
        const balance = userData.balance || 0;
        this.currencySubject.next(balance);
        return balance;
      } else {
        // Initialize new user with starting currency for slots
        await this.initializeUserCurrency(uid);
        return 1000;
      }
    } catch (error) {
      console.error('Failed to load currency balance:', error);
      return 0;
    }
  }

  /**
   * Initialize currency for a new user (called on first login)
   * New players start with 1000 coins for slots
   */
  async initializeUserCurrency(uid: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      await setDoc(
        userRef,
        {
          balance: 1000,
          totalEarned: 1000,
          totalSpent: 0,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
      this.currencySubject.next(1000);
    } catch (error) {
      console.error('Failed to initialize user currency:', error);
    }
  }

  /**
   * Add currency to user's balance (slots winnings)
   */
  async addCurrency(amount: number, reason: string = 'slots_win'): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      console.error('User not authenticated');
      return false;
    }

    try {
      const userRef = doc(this.firestore, 'users', uid);
      
      await updateDoc(userRef, {
        balance: increment(amount),
        totalEarned: increment(amount),
        lastUpdated: serverTimestamp(),
      });

      const newBalance = (this.currencySubject.getValue() || 0) + amount;
      this.currencySubject.next(newBalance);
      
      return true;
    } catch (error) {
      console.error('Failed to add currency:', error);
      return false;
    }
  }

  /**
   * Deduct currency from user's balance (slots bet)
   */
  async spendCurrency(amount: number, reason: string = 'slots_bet'): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      console.error('User not authenticated');
      return false;
    }

    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.error('User document not found');
        return false;
      }

      const currentBalance = (userSnap.data() as UserCurrency).balance || 0;
      if (currentBalance < amount) {
        console.error('Insufficient currency balance');
        return false;
      }

      await updateDoc(userRef, {
        balance: increment(-amount),
        totalSpent: increment(amount),
        lastUpdated: serverTimestamp(),
      });

      const newBalance = currentBalance - amount;
      this.currencySubject.next(newBalance);
      
      return true;
    } catch (error) {
      console.error('Failed to spend currency:', error);
      return false;
    }
  }

  /**
   * Check if user has enough currency
   */
  async hasEnoughCurrency(amount: number): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;

    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return false;
      
      const balance = (userSnap.data() as UserCurrency).balance || 0;
      return balance >= amount;
    } catch (error) {
      console.error('Failed to check currency balance:', error);
      return false;
    }
  }

  /**
   * Get current balance synchronously
   */
  getCurrentBalance(): number {
    return this.currencySubject.getValue() || 0;
  }

  /**
   * Get currency observable for template binding
   */
  getCurrencyObservable(): Observable<number> {
    return this.currency$;
  }
}
