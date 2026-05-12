import { Component, NgZone, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonSpinner, IonModal, IonBadge, IonChip, IonIcon,
  IonCard, IonCardContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophyOutline, checkmarkCircle, checkmarkCircleOutline, closeCircle } from 'ionicons/icons';
import { environment } from '../../environments/environment';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp } from '@angular/fire/firestore';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';
import { CurrencyService } from '../services/currency.service';
import { CurrencyDisplayComponent } from '../components/currency-display/currency-display.component';

interface Score {
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrl: 'tab4.page.scss',
  imports: [
    FormsModule, DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonSpinner, IonModal, IonBadge, IonChip, IonIcon,
    IonCard, IonCardContent,
    LogoutButtonComponent,
    CurrencyDisplayComponent,
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
  scores: Record<string, Score> = {};
  selectedEventOdds: { home: number | null; away: number | null } = { home: null, away: null };
  loadingOdds = false;
  pendingTeam: string | null = null;
  betAmount: number | null = null;
  balance = 0;
  betError = '';

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

  constructor(
    private zone: NgZone,
    private auth: Auth,
    private firestore: Firestore,
    private currencyService: CurrencyService,
  ) {
    addIcons({ trophyOutline, checkmarkCircle, checkmarkCircleOutline, closeCircle });
  }

  ngOnInit() {
    this.loadSports();
    this.loadEvents();
    this.loadPicksFromFirestore();
    this.balance = this.currencyService.getCurrentBalance();
    this.currencyService.currency$.subscribe(b => this.zone.run(() => this.balance = b));
  }

  private getCache<T>(key: string, ttlMs: number): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > ttlMs) { localStorage.removeItem(key); return null; }
      return data as T;
    } catch { return null; }
  }

  private setCache(key: string, data: unknown) {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  }

  loadSports() {
    const TTL = 24 * 60 * 60 * 1000; // 24 hours
    const cached = this.getCache<any[]>('cache:sports', TTL);
    if (cached) {
      this.sports = cached.filter((s: { slug: string }) => this.americanSports.has(s.slug));
      return;
    }
    fetch(`${environment.apiBaseUrl}/api/sports`)
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        this.sports = data.filter((s: { slug: string }) => this.americanSports.has(s.slug));
        this.setCache('cache:sports', data);
      }))
      .catch(err => console.error('Error fetching sports:', err));
  }

  loadEvents() {
    this.loading = true;
    this.events = [];
    this.selectedEvent = null;
    const TTL = 5 * 60 * 1000; // 5 minutes — short enough to pick up live score updates
    const cacheKey = `cache:events:${this.selectedSport}:${this.limit}`;
    const cached = this.getCache<any[]>(cacheKey, TTL);
    if (cached) {
      this.zone.run(() => {
        this.events = cached.filter((e: any) => e.league?.name?.startsWith('USA'));
        this.parseScoresFromEvents(this.events);
        this.loading = false;
      });
      return;
    }
    fetch(`${environment.apiBaseUrl}/api/events?sport=${this.selectedSport}&limit=${this.limit}`)
      .then(r => r.json())
      .then(data => this.zone.run(() => {
        this.events = data.filter((e: any) => e.league?.name?.startsWith('USA'));
        this.parseScoresFromEvents(data); // parse from full list before filtering
        this.loading = false;
        this.setCache(cacheKey, data);
      }))
      .catch(err => this.zone.run(() => { console.error('Error fetching events:', err); this.loading = false; }));
  }

  private parseScoresFromEvents(events: any[]) {
    const map: Record<string, Score> = { ...this.scores };
    events.forEach((e: any) => {
      if (!e.id) return;
      map[e.id] = {
        homeScore: e.scores?.home ?? null,
        awayScore: e.scores?.away ?? null,
        status: e.status ?? 'scheduled',
      };
    });
    this.scores = map;
  }

  async loadPicksFromFirestore() {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      const savedPicks = localStorage.getItem('picks');
      if (savedPicks) this.picks = JSON.parse(savedPicks);
      return;
    }
    try {
      const q = query(collection(this.firestore, 'sportsPicks'), where('uid', '==', uid));
      const snapshot = await getDocs(q);
      const firestorePicks: Record<string, string> = {};
      snapshot.forEach(d => {
        const data = d.data();
        firestorePicks[data['eventId']] = data['team'];
      });
      this.picks = firestorePicks;
      localStorage.setItem('picks', JSON.stringify(this.picks));
    } catch (err) {
      console.error('Firestore picks load failed, falling back to localStorage:', err);
      const savedPicks = localStorage.getItem('picks');
      if (savedPicks) this.picks = JSON.parse(savedPicks);
    }
  }

  selectSport(slug: string) {
    this.selectedSport = slug;
    this.loadEvents();
  }

  openBetModal(event: any) {
    this.selectedEvent = event;
    this.selectedEventOdds = { home: null, away: null };
    this.pendingTeam = this.picks[event.id] ?? null;
    this.betAmount = null;
    this.modalOpen = true;
    this.fetchOdds(event.id);
  }

  selectTeam(team: string) {
    if (this.isCompleted(this.selectedEvent)) return;
    this.pendingTeam = team;
    this.betAmount = null;
  }

  getPendingOdds(): number | null {
    if (!this.pendingTeam || !this.selectedEvent) return null;
    return this.pendingTeam === this.selectedEvent.home
      ? this.selectedEventOdds.home
      : this.selectedEventOdds.away;
  }

  calcPotentialWin(): number | null {
    const odds = this.getPendingOdds();
    if (odds === null || !this.betAmount || this.betAmount <= 0) return null;
    // Convert decimal odds to American if needed (same logic as formatOdds)
    let american = odds;
    if (odds > 0 && odds < 20) {
      american = odds >= 2
        ? Math.round((odds - 1) * 100)
        : Math.round(-100 / (odds - 1));
    }
    const win = american > 0
      ? this.betAmount * (american / 100)
      : this.betAmount * (100 / Math.abs(american));
    return Math.round(win * 100) / 100;
  }

  async confirmBet() {
    this.betError = '';
    if (!this.pendingTeam || !this.betAmount || this.betAmount <= 0) return;
    if (this.betAmount > this.balance) {
      this.betError = 'Insufficient balance.';
      return;
    }
    const success = await this.currencyService.spendCurrency(this.betAmount, 'sports_bet');
    if (!success) {
      this.betError = 'Failed to place bet. Try again.';
      return;
    }
    const potentialWin = this.calcPotentialWin();
    const odds = this.getPendingOdds();
    this.placePick(this.selectedEvent, this.pendingTeam, this.betAmount, odds, potentialWin);
  }

  async fetchOdds(eventId: string) {
    this.loadingOdds = true;
    try {
      const data = await fetch(`${environment.apiBaseUrl}/api/odds?eventId=${eventId}`).then(r => r.json());
      this.zone.run(() => {
        this.selectedEventOdds = this.parseOdds(data);
        this.loadingOdds = false;
      });
    } catch (e) {
      console.error('Failed to load odds:', e);
      this.zone.run(() => { this.loadingOdds = false; });
    }
  }

  private parseOdds(data: any): { home: number | null; away: number | null } {
    try {
      const bookmakers: any[] = Array.isArray(data) ? data : (data.bookmakers ?? data.data ?? []);
      if (!bookmakers.length) return { home: null, away: null };
      const bk = bookmakers[0];
      const markets: any[] = bk.markets ?? bk.odds ?? [];
      const ml = markets.find((m: any) =>
        ['moneyline', 'h2h', '1x2', 'money_line'].includes((m.name ?? m.type ?? '').toLowerCase())
      ) ?? markets[0];
      if (!ml) return { home: null, away: null };
      const outcomes: any[] = ml.outcomes ?? ml.selections ?? [];
      const homeOdds = outcomes.find((o: any) => o.name === this.selectedEvent?.home || o.label === 'home')?.odds ?? outcomes[0]?.odds ?? null;
      const awayOdds = outcomes.find((o: any) => o.name === this.selectedEvent?.away || o.label === 'away')?.odds ?? outcomes[1]?.odds ?? null;
      return { home: homeOdds, away: awayOdds };
    } catch {
      return { home: null, away: null };
    }
  }

  formatOdds(odds: number | null): string {
    if (odds === null || odds === undefined) return '';
    // Convert decimal odds to American if needed
    if (odds > 0 && odds < 20) {
      const american = odds >= 2
        ? Math.round((odds - 1) * 100)
        : Math.round(-100 / (odds - 1));
      return american > 0 ? `+${american}` : `${american}`;
    }
    return odds > 0 ? `+${odds}` : `${odds}`;
  }

  closeModal() {
    this.modalOpen = false;
  }

  getPick(eventId: string): string | null {
    return this.picks[eventId] ?? null;
  }

  getScore(eventId: string): Score | null {
    return this.scores[eventId] ?? null;
  }

  isLive(event: any): boolean {
    const s = this.scores[event.id];
    return s?.status === 'live' || s?.status === 'in_progress' || s?.status === 'inprogress';
  }

  isCompleted(event: any): boolean {
    const s = this.scores[event.id];
    if (s) return ['settled', 'cancelled', 'finished', 'completed', 'closed', 'final'].includes(s.status);
    return event.date ? new Date(event.date) < new Date() : false;
  }

  getPickResult(event: any): 'win' | 'loss' | null {
    const pick = this.getPick(event.id);
    const score = this.scores[event.id];
    if (!pick || !score || score.homeScore === null || score.awayScore === null) return null;
    if (!this.isCompleted(event)) return null;
    const homeWon = score.homeScore > score.awayScore;
    return (pick === event.home && homeWon) || (pick === event.away && !homeWon) ? 'win' : 'loss';
  }

  placePick(event: any, team: string, betAmount: number | null = null, odds: number | null = null, potentialWin: number | null = null) {
    this.picks[event.id] = team;
    localStorage.setItem('picks', JSON.stringify(this.picks));
    this.closeModal();

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
        betAmount: betAmount ?? null,
        odds: odds ?? null,
        potentialWin: potentialWin ?? null,
        settled: false,
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
