import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  imports: [IonButton, IonIcon],
  template: `
    <ion-button fill="clear" (click)="signOut()" aria-label="Sign out">
      <ion-icon name="person-circle-outline" slot="icon-only" style="font-size: 28px;"></ion-icon>
    </ion-button>
  `,
})
export class LogoutButtonComponent {
  constructor(private auth: Auth, private router: Router) {
    addIcons({ personCircleOutline });
  }

  async signOut() {
    await signOut(this.auth);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
