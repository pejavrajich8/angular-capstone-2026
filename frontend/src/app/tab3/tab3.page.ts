import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { CurrencyPipe} from '@angular/common';
import {CommonModule} from '@angular/common';

@NgModule({
  imports: [FormsModule, CommonModule],
  providers: [CurrencyPipe]
})
export class Tab3PageModule {}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    FormsModule,
    CommonModule,
    IonButton
],
})
export class Tab3Page {
balance: any;
betAmount: any;
isSpinning: any;
onBetChange() {
throw new Error('Method not implemented.');
}
reel1Offset: any;
reelSymbols: any;
reel2Offset: any;
reel3Offset: any;
lastResult: any;
spin() {
throw new Error('Method not implemented.');
}
spinHistory: any;
}
