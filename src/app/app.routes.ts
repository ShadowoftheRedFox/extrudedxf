import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ArComponent } from './pages/ar/ar.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'ar',
    component: ArComponent
  }
];
