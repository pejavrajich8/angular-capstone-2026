import { Component, NgZone, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonSpinner, IonModal, IonBadge, IonChip, IonIcon,
  IonCard, IonCardContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophyOutline, checkmarkCircle, checkmarkCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrl: 'tab4.page.scss',
  imports: [
    FormsModule, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonSpinner,
    IonModal, IonBadge, IonChip, IonIcon,
    IonCard, IonCardContent,
  ],
})
export class Tab4Page implements OnInit {
  sports: { name: string; slug: string }[] = [];
  events: any[] = [];
  selectedSport = 'american-football';
  selectedEvent: any = null;
  modalOpen = false;
  loading = false;
  picks: Record<string, string> = {};

  limit = parseInt(localStorage.getItem('oddsLimit') ?? '25', 10);

  constructor(private zone: NgZone) {
    addIcons({ trophyOutline, checkmarkCircle, checkmarkCircleOutline });
  }

  ngOnInit() {
    localStorage.setItem('oddsLimit', String(this.limit));
    const savedPicks = localStorage.getItem('picks');
    if (savedPicks) this.picks = JSON.parse(savedPicks);
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

  selectSport(slug: string) {
    this.selectedSport = slug;
    this.loadEvents();
  }

  openBetModal(event: any) {
    this.selectedEvent = event;
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }

  getPick(eventId: string): string | null {
    return this.picks[eventId] ?? null;
  }

  placePick(event: any, team: string) {
    this.picks[event.id] = team;
    localStorage.setItem('picks', JSON.stringify(this.picks));
    console.log(`Pick placed: ${team} for event ${event.id}`);
  }

  removePick(eventId: string) {
    delete this.picks[eventId];
    localStorage.setItem('picks', JSON.stringify(this.picks));
  }

  initials(name: string): string {
    return name.slice(0, 2).toUpperCase();
  }
}
