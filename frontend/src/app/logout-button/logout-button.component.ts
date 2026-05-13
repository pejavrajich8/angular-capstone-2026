import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, signOut, user } from '@angular/fire/auth';
import {
  IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personCircleOutline, logOutOutline, personOutline } from 'ionicons/icons';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  imports: [AsyncPipe, IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel],
  template: `
    <ion-button fill="clear" id="profile-menu-trigger" aria-label="Account menu">
      <ion-icon name="person-circle-outline" slot="icon-only" style="font-size: 28px;"></ion-icon>
    </ion-button>

    <ion-popover trigger="profile-menu-trigger" triggerAction="click" [dismissOnSelect]="true" side="bottom" alignment="end">
      <ng-template>
        <div class="profile-header">
          <ion-icon name="person-circle-outline" class="profile-avatar"></ion-icon>
          <div class="profile-info">
            <span class="profile-name">{{ (currentUser$ | async)?.displayName || 'Player' }}</span>
            <span class="profile-email">{{ (currentUser$ | async)?.email }}</span>
          </div>
        </div>

        <div class="menu-divider"></div>

        <ion-list lines="none" class="menu-list">
          <ion-item button detail="false" class="menu-item" (click)="signOut()">
            <ion-icon name="log-out-outline" slot="start" class="menu-icon signout-icon"></ion-icon>
            <ion-label class="signout-label">Sign Out</ion-label>
          </ion-item>
        </ion-list>
      </ng-template>
    </ion-popover>
  `,
  styles: [`
    .profile-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 16px 12px;
    }

    .profile-avatar {
      font-size: 42px;
      color: #a78bfa;
      flex-shrink: 0;
    }

    .profile-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .profile-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--ion-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .profile-email {
      font-size: 12px;
      color: var(--ion-color-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }

    .menu-divider {
      height: 1px;
      background: var(--ion-border-color, #e0e0e0);
      margin: 0 12px;
    }

    .menu-list {
      padding: 6px 0;
    }

    .menu-item {
      --padding-start: 16px;
      --inner-padding-end: 16px;
      --min-height: 44px;
    }

    .menu-icon {
      font-size: 18px;
    }

    .signout-icon {
      color: #ef4444;
    }

    .signout-label {
      color: #ef4444;
      font-size: 14px;
    }
  `],
})
export class LogoutButtonComponent {
  currentUser$;

  constructor(private auth: Auth, private router: Router) {
    this.currentUser$ = user(this.auth);
    addIcons({ personCircleOutline, logOutOutline, personOutline });
  }

  async signOut() {
    await signOut(this.auth);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
