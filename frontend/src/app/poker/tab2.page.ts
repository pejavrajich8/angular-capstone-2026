import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
} from '@ionic/angular/standalone';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';

@Component({
  selector: 'app-tab2',
  templateUrl: './tab2.page.html',
  styleUrls: ['./tab2.page.css'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, LogoutButtonComponent],
})
export class Tab2Page {}
