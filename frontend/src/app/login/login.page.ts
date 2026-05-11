import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: 'login.page.html',
  styleUrl: 'login.page.css',
  imports: [CommonModule, FormsModule, IonContent],
})
export class LoginPage {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: Auth, private router: Router) {}

  async loginWithEmail() {
    this.error = '';
    this.loading = true;
    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.password);
      this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.error('[Auth] email sign-in error:', e.code, e.message);
      this.error = this.friendlyError(e.code, e.message);
    } finally {
      this.loading = false;
    }
  }

  async loginWithGoogle() {
    this.error = '';
    this.loading = true;
    try {
      await signInWithPopup(this.auth, new GoogleAuthProvider());
      this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.error('[Auth] Google sign-in error:', e.code, e.message);
      this.error = this.friendlyError(e.code, e.message);
    } finally {
      this.loading = false;
    }
  }

  private friendlyError(code: string, message?: string): string {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      case 'auth/popup-closed-by-user':
        return '';
      case 'auth/configuration-not-found':
        return 'Firebase Authentication is not enabled for this project. Enable it in the Firebase Console → Authentication → Get Started.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Enable it in the Firebase Console → Authentication → Sign-in method.';
      default:
        return `Sign-in failed (${code ?? 'unknown'}). ${message ?? ''}`.trim();
    }
  }
}
