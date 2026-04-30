import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons],
})
export class Tab2Page {}
