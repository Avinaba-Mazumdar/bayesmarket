import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopHeaderDockComponent } from './core/components/top-header-dock/top-header-dock.component';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';
import { AuthDialogComponent } from './features/auth/auth-dialog.component';
import { FooterComponent } from './core/components/footer/footer.component';
import { ThemeService } from './core/services/theme.service';
import { ServerWakeBannerComponent } from './core/components/server-wake-banner/server-wake-banner.component';

@Component({
    imports: [RouterOutlet, TopHeaderDockComponent, FooterComponent, ToastContainerComponent, AuthDialogComponent, ServerWakeBannerComponent],
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './app.component.css',
    templateUrl: './app.component.html'
})
export class App {
    private readonly themeService = inject(ThemeService);
    protected readonly title = signal('BayesMarket');
}
