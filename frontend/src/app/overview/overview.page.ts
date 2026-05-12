import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonSpinner, IonBadge, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophyOutline, checkmarkCircle, closeCircle, timeOutline } from 'ionicons/icons';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';

interface Pick {
  eventId: string;
  team: string;
  home: string;
  away: string;
  league: string;
  sport: string;
  eventDate: any;
  betAmount: number | null;
  odds: number | null;
  potentialWin: number | null;
}

interface Score {
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

@Component({
  selector: 'app-overview',
  templateUrl: 'overview.page.html',
  styleUrl: 'overview.page.scss',
  imports: [
    DatePipe, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonSpinner, IonBadge, IonIcon,
    LogoutButtonComponent,
  ],
})
export class OverviewPage implements OnInit {
  picks: Pick[] = [];
  scores: Record<string, Score> = {};
  loading = true;

  constructor(private auth: Auth, private firestore: Firestore) {
    addIcons({ trophyOutline, checkmarkCircle, closeCircle, timeOutline });
  }

  async ngOnInit() {
    await this.loadPicks();
    await this.loadScores();
    this.loading = false;
  }

  async loadPicks() {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    try {
      const q = query(collection(this.firestore, 'sportsPicks'), where('uid', '==', uid));
      const snap = await getDocs(q);
      this.picks = snap.docs.map(d => d.data() as Pick)
        .sort((a, b) => {
          const da = a.eventDate?.toDate?.() ?? new Date(a.eventDate ?? 0);
          const db = b.eventDate?.toDate?.() ?? new Date(b.eventDate ?? 0);
          return db.getTime() - da.getTime();
        });
    } catch (err) {
      console.error('Failed to load picks:', err);
    }
  }

  async loadScores() {
    const sports = [...new Set(this.picks.map(p => p.sport).filter(Boolean))];
    await Promise.all(sports.map(async sport => {
      try {
        const data = await fetch(`${environment.apiBaseUrl}/api/scores?sport=${sport}`).then(r => r.json());
        if (!Array.isArray(data)) return;
        data.forEach((s: any) => {
          const id = s.id ?? s.eventId;
          if (!id) return;
          this.scores[id] = {
            homeScore: s.homeScore ?? s.home_score ?? s.scores?.home ?? null,
            awayScore: s.awayScore ?? s.away_score ?? s.scores?.away ?? null,
            status: s.status ?? 'scheduled',
          };
        });
      } catch (err) {
        console.error(`Failed to load scores for ${sport}:`, err);
      }
    }));
  }

  isCompleted(pick: Pick): boolean {
    const s = this.scores[pick.eventId];
    if (s) return ['finished', 'completed', 'closed', 'final'].includes(s.status);
    const date = pick.eventDate?.toDate?.() ?? new Date(pick.eventDate ?? 0);
    return date < new Date();
  }

  isLive(pick: Pick): boolean {
    const s = this.scores[pick.eventId];
    return s?.status === 'in_progress' || s?.status === 'live';
  }

  getResult(pick: Pick): 'win' | 'loss' | 'pending' | 'live' | 'final' {
    if (this.isLive(pick)) return 'live';
    const score = this.scores[pick.eventId];
    // No score data — check if the event date has passed
    if (!score || score.homeScore === null || score.awayScore === null) {
      return this.isCompleted(pick) ? 'final' : 'pending';
    }
    if (!this.isCompleted(pick)) return 'pending';
    const homeWon = score.homeScore > score.awayScore;
    const won = (pick.team === pick.home && homeWon) || (pick.team === pick.away && !homeWon);
    return won ? 'win' : 'loss';
  }

  getScore(eventId: string): Score | null {
    return this.scores[eventId] ?? null;
  }

  formatOdds(odds: number | null | undefined): string {
    if (odds === null || odds === undefined) return '—';
    if (odds > 0 && odds < 20) {
      const american = odds >= 2
        ? Math.round((odds - 1) * 100)
        : Math.round(-100 / (odds - 1));
      return american > 0 ? `+${american}` : `${american}`;
    }
    return odds > 0 ? `+${odds}` : `${odds}`;
  }

  get totalWagered(): number {
    return this.picks.reduce((s, p) => s + (p.betAmount ?? 0), 0);
  }

  get totalPotentialWin(): number {
    return this.picks
      .filter(p => this.getResult(p) === 'pending' || this.getResult(p) === 'live')
      .reduce((s, p) => s + (p.potentialWin ?? 0), 0);
  }

  get wins(): number {
    return this.picks.filter(p => this.getResult(p) === 'win').length;
  }

  get losses(): number {
    return this.picks.filter(p => this.getResult(p) === 'loss').length;
  }

  get pending(): number {
    return this.picks.filter(p => ['pending', 'live'].includes(this.getResult(p))).length;
  }

  get noResult(): number {
    return this.picks.filter(p => this.getResult(p) === 'final').length;
  }

  get totalWon(): number {
    return this.picks
      .filter(p => this.getResult(p) === 'win')
      .reduce((s, p) => s + (p.betAmount ?? 0) + (p.potentialWin ?? 0), 0);
  }
}
