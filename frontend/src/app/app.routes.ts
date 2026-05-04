import { Routes } from '@angular/router';
import { Tab1Page } from './tab1/tab1.page';

export const routes: Routes = [
  {
    path: 'tabs',
    children: [
      {
        path: 'tab1',
        component: Tab1Page,
      },
      // ...other tabs
    ],
  },
];
