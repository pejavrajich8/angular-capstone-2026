import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons],
})
export class Tab1Page {}
