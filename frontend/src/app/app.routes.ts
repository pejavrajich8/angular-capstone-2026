import { Routes } from '@angular/router';
import { Tab1Page } from './tab1/tab1.page';
import { Tab2Page } from './poker/tab2.page';
import { Tab3Page } from './tab3/tab3.page';
import { Tab4Page } from './tab4/tab4.page';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then(m => m.routes),
  },
  {
    path: 'tabs',
    children: [
      {
        path: 'tab1',
        component: Tab1Page,
      },
      {
        path: 'poker',
        component: Tab2Page,
      },
      {
        path: 'tab3',
        component: Tab3Page,
      },
      {
        path: 'tab4',
        component: Tab4Page,
      },
    ],
  },
];
