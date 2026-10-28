import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authRenewalInterceptor } from './core/interceptors/auth-renewal.interceptor';
import { coldStartInterceptor } from './core/interceptors/cold-start.interceptor';
import { ApiService } from './core/services/api.service';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withFetch(), withInterceptors([coldStartInterceptor, authRenewalInterceptor])),
        // Start waking the backend before any view asks for data. Bootstrap does not wait for it.
        provideAppInitializer(() => {
            inject(ApiService)
                .wakeServer()
                .subscribe({ error: () => undefined });
        })
    ]
};
