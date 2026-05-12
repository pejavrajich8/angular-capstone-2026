import { Component } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { triangle, ellipse, square, receiptOutline, footballOutline, cardOutline, diceOutline, statsChartOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.css'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  tabsHidden = false;

  constructor() {
    addIcons({ triangle, ellipse, square, receiptOutline, footballOutline, cardOutline, diceOutline, statsChartOutline });
  }

  toggleTabs() {
    this.tabsHidden = !this.tabsHidden;
  }
}
