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
import { environment } from '../../environments/environment';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc, deleteDoc, serverTimestamp } from '@angular/fire/firestore';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';

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
    LogoutButtonComponent,
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

  limit = 200;

  private readonly americanSports = new Set([
    'american-football',
    'basketball',
    'baseball',
    'ice-hockey',
    'mixed-martial-arts',
    'boxing',
    'lacrosse',
    'golf',
  ]);

  constructor(private zone: NgZone, private auth: Auth, private firestore: Firestore) {
    addIcons({ trophyOutline, checkmarkCircle, checkmarkCircleOutline });
  }

  ngOnInit() {
const savedPicks = localStorage.getItem('picks');
    if (savedPicks) this.picks = JSON.parse(savedPicks);
    this.loadSports();
    this.loadEvents();
  }

  loadSports() {
    const cached = localStorage.getItem('cache:sports');
    if (cached) {
      console.log('Sports loaded from cache');
      this.sports = JSON.parse(cached).filter((s: { slug: string }) => this.americanSports.has(s.slug));
      return;
    }
    console.log('Fetching sports...');
  fetch(`${environment.apiBaseUrl}/api/sports`)
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        console.log('Sports loaded:', data);
        this.sports = data.filter((s: { slug: string }) => this.americanSports.has(s.slug));
        localStorage.setItem('cache:sports', JSON.stringify(this.sports));
      }))
      .catch(err => console.error('Error fetching sports:', err));
  }

  loadEvents() {
    this.loading = true;
    this.events = [];
    this.selectedEvent = null;
    const cacheKey = `cache:events:${this.selectedSport}:${this.limit}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log(`Events loaded from cache for sport: ${this.selectedSport}`);
      this.zone.run(() => { this.events = JSON.parse(cached).filter((e: any) => e.league?.name?.startsWith('USA')); this.loading = false; });
      return;
    }
    console.log(`Fetching events for sport: ${this.selectedSport}...`);
  fetch(`${environment.apiBaseUrl}/api/events?sport=${this.selectedSport}&limit=${this.limit}`)
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        console.log('Events loaded:', data);
        this.events = data.filter((e: any) => e.league?.name?.startsWith('USA'));
        this.loading = false;
        localStorage.setItem(cacheKey, JSON.stringify(this.events));
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

    const uid = this.auth.currentUser?.uid;
    if (uid) {
      const pickRef = doc(collection(this.firestore, 'sportsPicks'), `${uid}_${event.id}`);
      setDoc(pickRef, {
        uid,
        eventId: event.id,
        team,
        sport: this.selectedSport,
        home: event.home,
        away: event.away,
        league: event.league?.name ?? '',
        eventDate: event.date ?? null,
        timestamp: serverTimestamp(),
      }).catch(err => console.error('Firestore pick save failed:', err));
    }
  }

  removePick(eventId: string) {
    delete this.picks[eventId];
    localStorage.setItem('picks', JSON.stringify(this.picks));

    const uid = this.auth.currentUser?.uid;
    if (uid) {
      const pickRef = doc(collection(this.firestore, 'sportsPicks'), `${uid}_${eventId}`);
      deleteDoc(pickRef).catch(err => console.error('Firestore pick delete failed:', err));
    }
  }

  initials(name: string): string {
    return name.slice(0, 2).toUpperCase();
  }
}
