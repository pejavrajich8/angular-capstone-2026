/**
 * LOGIN PAGE WITH CURRENCY INTEGRATION EXAMPLE
 * 
 * Shows how to initialize currency for new users during login
 * 
 * When a user logs in for the first time, they automatically get 1000 coins
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, UserCredential,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { IonContent } from '@ionic/angular/standalone';
import { CurrencyService } from '../services/currency.service';

@Component({
  selector: 'app-login-with-currency-example',
  standalone: true,
  template: `
    <div class="login-container">
      <h1>Login</h1>
      
      <form (ngSubmit)="loginWithEmail()">
        <input [(ngModel)]="email" name="email" type="email" placeholder="Email" />
        <input [(ngModel)]="password" name="password" type="password" placeholder="Password" />
        <button type="submit" [disabled]="loading">Login with Email</button>
      </form>

      <button (click)="loginWithGoogle()" [disabled]="loading">Login with Google</button>

      <p *ngIf="error" class="error">{{ error }}</p>
      <p *ngIf="loading" class="loading">Logging in...</p>
    </div>
  `,
  styles: [`
    .login-container {
      max-width: 400px;
      margin: 50px auto;
      padding: 20px;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    input {
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    button {
      padding: 10px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .error {
      color: red;
      margin-top: 10px;
    }

    .loading {
      color: blue;
      margin-top: 10px;
    }
  `]
})
export class LoginWithCurrencyExampleComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private currencyService: CurrencyService
  ) {}

  async loginWithEmail() {
    this.error = '';
    this.loading = true;
    try {
      const cred = await signInWithEmailAndPassword(this.auth, this.email, this.password);
      await this.saveUserDoc(cred);
      this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.error('[Auth] email sign-in error:', e.code, e.message);
      this.error = 'Login failed';
    } finally {
      this.loading = false;
    }
  }

  async loginWithGoogle() {
    this.error = '';
    this.loading = true;
    try {
      const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
      await this.saveUserDoc(cred);
      this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.error('[Auth] Google sign-in error:', e.code, e.message);
      this.error = 'Google login failed';
    } finally {
      this.loading = false;
    }
  }

  private async saveUserDoc(cred: UserCredential) {
    const { uid, email, displayName, photoURL } = cred.user;
    
    // Save user document
    await setDoc(doc(this.firestore, 'users', uid), {
      uid,
      email,
      displayName: displayName ?? email?.split('@')[0] ?? 'Player',
      photoURL: photoURL ?? null,
      lastLogin: serverTimestamp(),
    }, { merge: true });

    // Initialize currency for the user
    // This will give them 1000 coins if they're a new user
    await this.currencyService.initializeUserCurrency(uid);
  }
}
