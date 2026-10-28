import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/market/market-list.component').then((m) => m.MarketListComponent),
        title: 'BayesMarket — Binary Prediction Markets'
    },
    {
        path: 'markets/:id',
        loadComponent: () => import('./features/market/market-detail.component').then((m) => m.MarketDetailComponent),
        title: 'Trading Cockpit — BayesMarket'
    },
    {
        path: 'portfolio',
        loadComponent: () => import('./features/portfolio/portfolio-view.component').then((m) => m.PortfolioViewComponent),
        title: 'Portfolio & PnL Ledger — BayesMarket'
    },
    {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
        canActivate: [adminGuard],
        title: 'Admin Liquidity & Market Creator — BayesMarket'
    },
    {
        path: 'auth/callback',
        loadComponent: () => import('./features/auth/auth-callback.component').then((m) => m.AuthCallbackComponent),
        title: 'Authenticating — BayesMarket'
    },
    {
        path: 'privacy',
        loadComponent: () => import('./features/legal/privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent),
        title: 'Privacy Policy — BayesMarket'
    },
    {
        path: 'terms',
        loadComponent: () => import('./features/legal/terms/terms.component').then((m) => m.TermsComponent),
        title: 'Terms and Conditions — BayesMarket'
    },
    {
        path: '**',
        redirectTo: ''
    }
];
