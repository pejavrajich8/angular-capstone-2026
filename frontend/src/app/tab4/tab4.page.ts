import { Component, NgZone, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  imports: [
    FormsModule, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  ],
})
export class Tab4Page implements OnInit {
  sports: { name: string; slug: string }[] = [];
  events: any[] = [];
  odds: any = null;
  selectedSport = 'american-football';
  selectedEvent: any = null;
  loading = false;

  limit = parseInt(localStorage.getItem('oddsLimit') ?? '25', 10);

  constructor(private zone: NgZone) {}

  ngOnInit() {
    localStorage.setItem('oddsLimit', String(this.limit));
    console.log(`Odds limit set to ${this.limit} (from localStorage)`);
    this.loadSports();
    this.loadEvents();
  }

  loadSports() {
    const cached = localStorage.getItem('cache:sports');
    if (cached) {
      console.log('Sports loaded from cache');
      this.sports = JSON.parse(cached);
      return;
    }
    console.log('Fetching sports...');
    fetch('/api/sports')
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        console.log('Sports loaded:', data);
        this.sports = data;
        localStorage.setItem('cache:sports', JSON.stringify(data));
      }))
      .catch(err => console.error('Error fetching sports:', err));
  }

  loadEvents() {
    this.loading = true;
    this.events = [];
    this.selectedEvent = null;
    this.odds = null;
    const cacheKey = `cache:events:${this.selectedSport}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log(`Events loaded from cache for sport: ${this.selectedSport}`);
      this.zone.run(() => { this.events = JSON.parse(cached); this.loading = false; });
      return;
    }
    console.log(`Fetching events for sport: ${this.selectedSport}...`);
    fetch(`/api/events?sport=${this.selectedSport}&limit=${this.limit}`)
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        console.log('Events loaded:', data);
        this.events = data;
        this.loading = false;
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }))
      .catch(err => this.zone.run(() => { console.error('Error fetching events:', err); this.loading = false; }));
  }

  onSportChange() {
    this.loadEvents();
  }

  selectEvent(event: any) {
    this.selectedEvent = event;
    this.odds = null;
    const cacheKey = `cache:odds:${event.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log(`Odds loaded from cache for event: ${event.id}`);
      this.zone.run(() => { this.odds = JSON.parse(cached); });
      return;
    }
    console.log(`Fetching odds for event: ${event.id} (${event.home} vs ${event.away})...`);
    fetch(`/api/odds?eventId=${event.id}`)
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        console.log('Odds loaded:', data);
        this.odds = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }))
      .catch(err => console.error('Error fetching odds:', err));
  }
}
