import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tab1',
  standalone: true,
  templateUrl: 'tab1.page.html',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton],
})
export class Tab1Page {
  deckId: string = '';

  constructor(private http: HttpClient) {}

  createDeck() {
    this.http.get('/api/deck/create').subscribe((data: any) => {
      console.log('New deck:', data);
      this.deckId = data.deck_id;
    });
  }

  drawCards(count: number = 2) {
    this.http.get(`/api/deck/draw?deckId=${this.deckId}&count=${count}`)
      .subscribe((data: any) => {
        console.log('Cards drawn:', data.cards);
      });
  }
}