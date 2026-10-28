import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideSearch, LucideSearchX } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { Market } from '../../core/models/market.model';
import { MarketCardComponent } from './market-card.component';
import { GlossaryPopoverComponent } from './glossary-popover.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { handleRovingKeydown } from '../../core/utils/roving-focus';
import { addDecimal, formatDecimal } from '../../core/utils/decimal';

export type CategoryFilter = string;

@Component({
    selector: 'app-market-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MarketCardComponent, GlossaryPopoverComponent, ButtonComponent, InputComponent, LucideSearch, LucideSearchX],
    template: `
        <div class="market-catalog-container">
            <!-- Hero Banner: Platform Mission & Market Stats -->
            <section class="hero-section" aria-labelledby="hero-title">
                <div class="hero-content">
                    <span class="hero-badge">
                        <span class="pulse-dot" aria-hidden="true"></span>
                        LIVE PREDICTION EXCHANGE
                    </span>
                    <h1 id="hero-title" class="hero-title">Trade the Probability of Tomorrow.</h1>
                    <p class="hero-desc">
                        Binary prediction markets priced by a fixed-point constant-product market maker. Every outcome share is backed by collateral, and
                        winning shares pay $1.00 USDC at resolution.
                    </p>
                </div>

                <div class="hero-stats-panel" role="region" aria-label="Exchange statistics">
                    <div class="stat-box">
                        <span class="stat-label">Active Markets</span>
                        <span class="stat-val tabular-nums">{{ markets().length }}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Total Volume</span>
                        <span class="stat-val tabular-nums">{{ '$' + totalVolume() }}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Collateral Locked</span>
                        <span class="stat-val tabular-nums">{{ '$' + totalCollateral() }}</span>
                    </div>
                </div>
            </section>

            <!-- Filter Controls & Search Bar -->
            <section class="catalog-controls" aria-label="Market filters and search">
                <!-- Category Filter Chips -->
                <div
                    class="category-tabs"
                    role="tablist"
                    aria-label="Filter markets by category"
                    (keydown)="rovingKeydown($event, '[role=tab]')"
                >
                    @for (cat of categories(); track cat.id) {
                        <app-button
                            variant="chip"
                            size="sm"
                            [selected]="selectedCategory() === cat.id"
                            buttonRole="tab"
                            [ariaLabel]="'Filter by ' + cat.label"
                            (btnClick)="setCategory(cat.id)"
                        >
                            {{ cat.label }}
                        </app-button>
                    }
                </div>

                <!-- Right Tools: Search Bar & Glossary Trigger -->
                <div class="filter-tools-right">
                    <div class="search-input-container">
                        <app-input
                            type="search"
                            size="sm"
                            [value]="searchQuery()"
                            (valueChange)="searchQuery.set($event.toString())"
                            placeholder="Search prediction markets..."
                            ariaLabel="Search prediction markets by title or keyword"
                        >
                            <svg prefix lucideSearch class="search-icon" [size]="16" aria-hidden="true"></svg>
                        </app-input>
                    </div>
                    <app-glossary-popover />
                </div>
            </section>

            <!-- Active Markets Catalog Grid -->
            <section class="catalog-grid-section" aria-label="Active prediction markets">
                @if (isLoading()) {
                    <div class="loading-state" role="status">
                        <div class="spinner" aria-hidden="true"></div>
                        <p class="loading-text">Loading prediction markets...</p>
                    </div>
                } @else if (loadError()) {
                    <div class="empty-state" role="alert">
                        <h3>Markets could not be loaded</h3>
                        <p>Check your connection, then try again.</p>
                        <app-button variant="secondary" size="default" ariaLabel="Try loading markets again" (btnClick)="retryLoad()">Try again</app-button>
                    </div>
                } @else if (filteredMarkets().length === 0) {
                    <div class="empty-state" role="status">
                        <svg lucideSearchX class="empty-icon" [size]="40" aria-hidden="true"></svg>
                        <h3>No Markets Found</h3>
                        <p>No active prediction markets match your selected filter or search term.</p>
                        <app-button variant="secondary" size="default" (btnClick)="resetFilters()"> Reset Filters </app-button>
                    </div>
                } @else {
                    <div class="markets-grid">
                        @for (market of filteredMarkets(); track market.id) {
                            <app-market-card [market]="market" />
                        }
                    </div>
                }
            </section>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .market-catalog-container {
                max-width: 1440px;
                margin: 0 auto;
                padding: var(--space-xl) var(--space-lg) 64px;
                display: flex;
                flex-direction: column;
                gap: 32px;
            }

            /* --- Hero Section --- */
            .hero-section {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
                padding: 32px 28px;
                background: var(--hero-gradient);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                position: relative;
                overflow: hidden;
                box-shadow: var(--shadow-md);
            }

            .hero-section::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -20%;
                width: 70%;
                height: 200%;
                background: var(--hero-glow);
                pointer-events: none;
            }

            .hero-content {
                max-width: 640px;
                position: relative;
                z-index: 1;
            }

            .hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background-color: var(--primary-subtle);
                border: 1px solid var(--primary-border);
                border-radius: var(--radius-pill);
                padding: 4px 12px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 700;
                color: var(--primary-text);
                letter-spacing: 0.5px;
                margin-bottom: 12px;
            }

            .pulse-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--primary-text);
                box-shadow: 0 0 6px var(--primary-text);
            }

            .hero-title {
                font-family: var(--font-ui);
                font-size: 32px;
                font-weight: 700;
                line-height: 1.2;
                color: var(--ink);
                letter-spacing: -0.5px;
                margin-bottom: 12px;
            }

            .hero-desc {
                font-family: var(--font-ui);
                font-size: 14.5px;
                line-height: 1.55;
                color: var(--muted);
                margin: 0;
            }

            .hero-stats-panel {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: 16px 20px;
                position: relative;
                z-index: 1;
                min-width: 420px;
            }

            .stat-box {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .stat-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 600;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }

            .stat-val {
                font-family: var(--font-mono);
                font-size: 19px;
                font-weight: 700;
                color: var(--ink);
                font-feature-settings: 'tnum' 1;
            }

            /* --- Controls Bar --- */
            .catalog-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 16px;
            }

            .category-tabs {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .filter-tools-right {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }

            .search-input-wrapper {
                display: flex;
                align-items: center;
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-pill);
                padding: 4px 14px;
                gap: 8px;
                min-height: var(--touch-target-min);
                min-width: 260px;
                box-sizing: border-box;
                transition:
                    border-color 0.15s ease,
                    box-shadow 0.15s ease;
            }

            .search-input-wrapper:focus-within {
                border-color: var(--focus-outline);
                box-shadow: 0 0 0 3px var(--focus-ring);
            }

            .search-icon {
                color: var(--muted);
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .search-input {
                background: transparent;
                border: none;
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: 13.5px;
                outline: none;
                box-shadow: none;
                width: 100%;
            }

            .search-input:focus,
            .search-input:focus-visible {
                outline: none;
                box-shadow: none;
            }

            .search-input::-webkit-search-decoration,
            .search-input::-webkit-search-cancel-button,
            .search-input::-webkit-search-results-button,
            .search-input::-webkit-search-results-decoration {
                -webkit-appearance: none;
            }

            /* --- Markets Grid --- */
            .markets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 18px;
            }

            /* --- States --- */
            .loading-state,
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 64px 20px;
                text-align: center;
                gap: 12px;
            }

            .spinner {
                width: 36px;
                height: 36px;
                border: 3px solid rgba(124, 77, 255, 0.2);
                border-top-color: var(--primary-border);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }

            .loading-text {
                font-family: var(--font-ui);
                font-size: 15px;
                color: var(--muted);
            }

            .empty-icon {
                color: var(--muted);
                margin-bottom: 4px;
            }

            .empty-state h3 {
                margin: 0;
                font-size: 18px;
                color: var(--ink);
            }

            .empty-state p {
                margin: 0 0 16px 0;
                color: var(--muted);
                font-size: 14px;
            }

            @media (max-width: 1024px) {
                .hero-section {
                    flex-direction: column;
                    align-items: stretch;
                }
                .hero-stats-panel {
                    min-width: unset;
                }
            }

            @media (max-width: 640px) {
                .hero-title {
                    font-size: 26px;
                }
                .hero-stats-panel {
                    grid-template-columns: 1fr;
                }
                .catalog-controls {
                    flex-direction: column;
                    align-items: stretch;
                }
                .filter-tools-right {
                    flex-direction: column;
                    align-items: stretch;
                }
                .search-input-wrapper {
                    min-width: 100%;
                }
            }
        `
    ]
})
export class MarketListComponent implements OnInit {
    protected readonly rovingKeydown = handleRovingKeydown;
    private readonly apiService = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);

    readonly markets = signal<Market[]>([]);
    readonly isLoading = signal<boolean>(true);
    readonly selectedCategory = signal<CategoryFilter>('all');
    readonly searchQuery = signal<string>('');

    /** Filter chips: 'All' plus the server's category list, loaded on init. */
    protected readonly categories = signal<{ id: CategoryFilter; label: string }[]>([{ id: 'all', label: 'All Markets' }]);
    protected readonly loadError = signal<boolean>(false);

    protected readonly totalVolume = computed(() => {
        const total = this.markets().reduce((acc, m) => addDecimal(acc, m.reserves?.total_volume_usdc || '0') ?? acc, '0');
        return formatDecimal(total, 2, true) ?? '0.00';
    });

    protected readonly totalCollateral = computed(() => {
        const total = this.markets().reduce((acc, m) => addDecimal(acc, m.reserves?.collateral_reserve || '0') ?? acc, '0');
        return formatDecimal(total, 2, true) ?? '0.00';
    });

    protected readonly filteredMarkets = computed(() => {
        const cat = this.selectedCategory();
        const query = this.searchQuery().trim().toLowerCase();
        let list = this.markets();

        if (cat !== 'all') {
            list = list.filter((m) => m.category.toLowerCase() === cat);
        }

        if (query) {
            list = list.filter(
                (m) => m.title.toLowerCase().includes(query) || m.description.toLowerCase().includes(query) || m.category.toLowerCase().includes(query)
            );
        }

        return list;
    });

    ngOnInit(): void {
        // The catalog is a snapshot; live prices are streamed on the market page, not here.
        this.fetchMarkets();
        this.apiService
            .getMarketCategories()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (list) => this.categories.set([{ id: 'all', label: 'All Markets' }, ...list]),
                error: () => undefined
            });
    }

    setCategory(cat: CategoryFilter): void {
        this.selectedCategory.set(cat);
    }

    resetFilters(): void {
        this.selectedCategory.set('all');
        this.searchQuery.set('');
    }

    retryLoad(): void {
        this.fetchMarkets();
    }

    private fetchMarkets(): void {
        this.isLoading.set(true);
        this.loadError.set(false);
        this.apiService
            .getMarkets()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (data) => {
                    this.markets.set(data || []);
                    this.isLoading.set(false);
                },
                error: (err) => {
                    console.error('Failed to load markets:', err);
                    this.isLoading.set(false);
                    this.loadError.set(true);
                }
            });
    }
}
