import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Auth, createUserWithEmailAndPassword, updateProfile,
  GoogleAuthProvider, signInWithPopup, UserCredential,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { IonContent } from '@ionic/angular/standalone';
import { CurrencyService } from '../services/currency.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: 'signup.page.html',
  styleUrl: 'signup.page.css',
  imports: [CommonModule, FormsModule, IonContent],
})
export class SignupPage {
  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  loading = false;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private currencyService: CurrencyService,
  ) {}

  async signUpWithEmail() {
    this.error = '';
    if (!this.displayName.trim()) { this.error = 'Please enter a display name.'; return; }
    if (this.password !== this.confirmPassword) { this.error = 'Passwords do not match.'; return; }
    if (this.password.length < 6) { this.error = 'Password must be at least 6 characters.'; return; }

    this.loading = true;
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      await updateProfile(cred.user, { displayName: this.displayName.trim() });
      await this.saveUserDoc(cred, this.displayName.trim());
      this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.error('[Auth] sign-up error:', e.code, e.message);
      this.error = this.friendlyError(e.code, e.message);
    } finally {
      this.loading = false;
    }
  }

  async signUpWithGoogle() {
    this.error = '';
    this.loading = true;
    try {
      const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
      await this.saveUserDoc(cred);
      this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.error('[Auth] Google sign-up error:', e.code, e.message);
      this.error = this.friendlyError(e.code, e.message);
    } finally {
      this.loading = false;
    }
  }

  goToLogin() {
    this.router.navigateByUrl('/login');
  }

  private async saveUserDoc(cred: UserCredential, name?: string) {
    const { uid, email, displayName, photoURL } = cred.user;
    // Initialize currency first — so the doc is created with balance:1000 before
    // setDoc merges in the profile fields (initializeUserCurrency skips if doc exists).
    await this.currencyService.initializeUserCurrency(uid).catch(err =>
      console.warn('[Currency] initialization failed:', err)
    );
    setDoc(doc(this.firestore, 'users', uid), {
      uid,
      email,
      displayName: name ?? displayName ?? email?.split('@')[0] ?? 'Player',
      photoURL: photoURL ?? null,
      lastLogin: serverTimestamp(),
    }, { merge: true }).catch(err =>
      console.warn('[Firestore] users doc write failed:', err.code)
    );
  }

  private friendlyError(code: string, message?: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/popup-closed-by-user':
        return '';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/operation-not-allowed':
        return 'Sign-up is not enabled. Contact the administrator.';
      default:
        return `Sign-up failed (${code ?? 'unknown'}). ${message ?? ''}`.trim();
    }
  }
}
