import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    AfterViewInit,
    OnDestroy,
    OnInit,
    signal,
    untracked,
    viewChild
} from '@angular/core';
import { AreaSeries, ColorType, createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { LucideTrendingUp, LucideTrendingDown } from '@lucide/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { ThemeService } from '../../core/services/theme.service';
import { HistoryRange, MarketHistoryResponse } from '../../core/models/market.model';
import { ButtonComponent } from '../../shared/components/button/button.component';

export type ChartTimeframe = '1H' | '1D' | '1W' | 'ALL';
export type HistoryState = 'loading' | 'ready' | 'empty' | 'error';

const RANGE_FOR_TIMEFRAME: Record<ChartTimeframe, HistoryRange> = {
    '1H': '1h',
    '1D': '24h',
    '1W': '7d',
    ALL: 'all'
};

/** Rows shown to screen readers; the full series is drawn on the canvas. */
const TABLE_ROW_LIMIT = 50;

interface ChartPoint {
    time: UTCTimestamp;
    value: number;
}

@Component({
    selector: 'app-price-chart',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, LucideTrendingUp, LucideTrendingDown],
    template: `
        <div class="price-chart-container" role="region" [attr.aria-label]="chartAriaLabel()">
            <!-- Header Bar: Current Probability & Timeframe Chips -->
            <div class="chart-header">
                <div class="probability-display">
                    <span class="prob-label">Implied Probability (YES)</span>
                    <div class="prob-stat-row">
                        <span class="prob-value tabular-nums">{{ formattedProbability() }}</span>
                        @if (hasChange()) {
                            <span class="prob-change" [class.positive]="priceChange() >= 0" [class.negative]="priceChange() < 0">
                                @if (priceChange() >= 0) {
                                    <svg lucideTrendingUp class="prob-change-icon" [size]="14" aria-hidden="true"></svg>
                                    +{{ formattedChange() }}%
                                } @else {
                                    <svg lucideTrendingDown class="prob-change-icon" [size]="14" aria-hidden="true"></svg>
                                    -{{ formattedChange() }}%
                                }
                            </span>
                        }
                        <span class="timeframe-label">{{ selectedTimeframe() }}</span>
                    </div>
                </div>

                <!-- Timeframe Selector Chips (WCAG SC 2.5.5 Level AAA min 40x40px) -->
                <div class="timeframe-selector" role="group" aria-label="Chart timeframe selector">
                    @for (tf of timeframes; track tf) {
                        <app-button
                            variant="chip"
                            size="sm"
                            [selected]="selectedTimeframe() === tf"
                            [attr.aria-pressed]="selectedTimeframe() === tf"
                            [ariaLabel]="'Select ' + tf + ' timeframe'"
                            (btnClick)="selectTimeframe(tf)"
                        >
                            {{ tf }}
                        </app-button>
                    }
                </div>
            </div>

            <!-- Canvas Container. States sit outside the aria-hidden canvas so assistive technology reads them. -->
            <div class="chart-canvas-wrapper">
                <div #chartContainer class="chart-canvas" aria-hidden="true"></div>

                @if (historyState() === 'loading') {
                    <p class="chart-state" role="status">Loading price history…</p>
                }
                @if (historyState() === 'empty') {
                    <p class="chart-state" role="status">
                        No recorded prices in this range. The line starts at the first trade stored after price history was enabled, and it updates live.
                    </p>
                }
                @if (historyState() === 'error') {
                    <div class="chart-state chart-state-error" role="alert">
                        <p>Price history could not be loaded.</p>
                        <app-button variant="outline" size="sm" ariaLabel="Retry loading price history" (btnClick)="loadHistory()">Retry</app-button>
                    </div>
                }
            </div>

            <!-- Accessibility alternative: the same recorded data as the canvas -->
            <div class="sr-only">
                <table>
                    <caption>
                        Recorded implied probabilities for
                        {{
                            selectedTimeframe()
                        }}, newest first
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Time (UTC)</th>
                            <th scope="col">Implied probability (YES)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (row of tableRows(); track row.time) {
                            <tr>
                                <td>{{ row.time }}</td>
                                <td>{{ row.probability }}</td>
                            </tr>
                        } @empty {
                            <tr>
                                <td colspan="2">No recorded trades in this range.</td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
            }

            .price-chart-container {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-xl);
                padding: var(--space-lg);
                display: flex;
                flex-direction: column;
                gap: 16px;
                box-shadow: var(--shadow-sm);
            }

            .chart-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 16px;
            }

            .probability-display {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .prob-label {
                font-family: var(--font-ui);
                font-size: 13px;
                font-weight: 600;
                color: var(--muted);
                letter-spacing: 0.2px;
            }

            .prob-stat-row {
                display: flex;
                align-items: baseline;
                gap: 12px;
            }

            .prob-value {
                font-family: var(--font-mono);
                font-size: 32px;
                font-weight: 700;
                color: var(--outcome-yes-text);
                line-height: 1.1;
                font-feature-settings: 'tnum' 1;
            }

            .prob-change {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: var(--font-mono);
                font-size: 14px;
                font-weight: 600;
                font-feature-settings: 'tnum' 1;
            }

            .prob-change-icon {
                flex-shrink: 0;
            }

            .prob-change.positive {
                color: var(--status-profit);
            }

            .prob-change.negative {
                color: var(--status-loss);
            }

            .timeframe-label {
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--muted);
                background-color: var(--canvas-subtle);
                padding: 2px 8px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--hairline);
            }

            .timeframe-selector {
                display: flex;
                align-items: center;
                gap: 6px;
                background-color: var(--canvas-subtle);
                padding: 4px;
                border-radius: var(--radius-lg);
                border: 1px solid var(--hairline);
            }

            .chart-canvas {
                position: absolute;
                inset: 0;
            }

            .chart-state {
                position: absolute;
                inset: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 16px;
                text-align: center;
                font-size: 14px;
                color: var(--muted);
                background-color: var(--surface-card);
                pointer-events: none;
            }

            .chart-state-error {
                pointer-events: auto;
            }

            .chart-canvas-wrapper {
                width: 100%;
                height: 360px;
                position: relative;
                overflow: hidden;
                border-radius: var(--radius-lg);
                background-color: var(--canvas);
                border: 1px solid var(--hairline);
                contain: layout paint size;
            }

            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }

            @media (max-width: 640px) {
                .chart-canvas-wrapper {
                    height: 280px;
                }
                .prob-value {
                    font-size: 26px;
                }
                .chart-header {
                    flex-direction: column;
                }
            }
        `
    ]
})
export class PriceChartComponent implements OnInit, AfterViewInit, OnDestroy {
    readonly marketId = input<string>('');
    readonly initialProbabilityYes = input<number>(0.5);

    protected readonly chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

    private readonly wsService = inject(WebSocketService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly themeService = inject(ThemeService);
    private readonly apiService = inject(ApiService);

    protected readonly timeframes: ChartTimeframe[] = ['1H', '1D', '1W', 'ALL'];
    readonly selectedTimeframe = signal<ChartTimeframe>('1D');
    readonly currentProbability = signal<number>(0.5);
    readonly priceChange = signal<number>(0.0);
    /** True only when recorded history gives a real first and last value to compare. */
    readonly hasChange = signal<boolean>(false);
    readonly historyState = signal<HistoryState>('loading');
    readonly tableRows = signal<{ time: string; probability: string }[]>([]);
    private requestSeq = 0;

    private chart: IChartApi | null = null;
    private areaSeries: ISeriesApi<'Area'> | null = null;
    private tickRafId: number | null = null;
    private pendingTick: { prob: number; date: Date } | null = null;
    private currentData: ChartPoint[] = [];

    readonly formattedProbability = computed(() => {
        const p = this.currentProbability();
        return `${(p * 100).toFixed(1)}%`;
    });

    protected readonly formattedChange = computed(() => {
        return Math.abs(this.priceChange()).toFixed(2);
    });

    protected readonly chartAriaLabel = computed(() => {
        return `Probability chart for market, current probability is ${this.formattedProbability()}`;
    });

    constructor() {
        // Stream live ticks into the chart series directly without triggering Angular CD cycles
        effect(() => {
            const tick = this.wsService.lastPriceTick();
            const activeId = this.marketId();

            if (tick && (!tick.market_id || tick.market_id === activeId)) {
                const yesPrice = parseFloat(tick.yes_price);
                if (!isNaN(yesPrice)) {
                    untracked(() => {
                        this.onNewPriceTick(yesPrice, tick.timestamp ? new Date(tick.timestamp) : new Date());
                    });
                }
            }
        });

        // Redraw from the design tokens whenever the theme changes
        effect(() => {
            this.themeService.theme();
            untracked(() => this.updateChartTheme());
        });

        // Load history for a new market once the chart exists
        effect(() => {
            this.marketId();
            untracked(() => {
                if (this.chart) this.loadHistory();
            });
        });
    }

    ngOnInit(): void {
        const initProb = this.initialProbabilityYes();
        if (initProb && !isNaN(initProb)) {
            this.currentProbability.set(initProb);
        }
    }

    ngAfterViewInit(): void {
        this.initChart();
    }

    ngOnDestroy(): void {
        this.teardownChart();
        this.currentData = [];
    }

    /**
     * Chart colours come from the active design tokens, so the canvas follows the theme and DESIGN.md.
     * The canvas library needs concrete colour strings, so the values are read when a chart is drawn.
     */
    private palette(): Record<'background' | 'text' | 'grid' | 'scale' | 'crosshair' | 'crosshairLabel' | 'line' | 'top' | 'bottom', string> {
        const css = getComputedStyle(document.documentElement);
        const token = (name: string): string => css.getPropertyValue(name).trim();
        return {
            background: token('--surface-card'),
            text: token('--muted'),
            grid: token('--hairline'),
            scale: token('--hairline'),
            crosshair: token('--primary-text'),
            crosshairLabel: token('--primary'),
            line: token('--outcome-yes'),
            top: token('--outcome-yes-glow'),
            bottom: 'rgba(0, 0, 0, 0)'
        };
    }

    private initChart(): void {
        const el = this.chartContainer()?.nativeElement;
        if (!el) return;
        const p = this.palette();
        {
            this.chart = createChart(el, {
                autoSize: true,
                layout: {
                    background: { type: ColorType.Solid, color: p.background },
                    textColor: p.text,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace"
                },
                grid: {
                    vertLines: { color: p.grid, style: 1 },
                    horzLines: { color: p.grid, style: 1 }
                },
                crosshair: {
                    vertLine: { color: p.crosshair, width: 1, style: 2, labelBackgroundColor: p.crosshairLabel },
                    horzLine: { color: p.crosshair, width: 1, style: 2, labelBackgroundColor: p.crosshairLabel }
                },
                rightPriceScale: {
                    borderColor: p.scale,
                    scaleMargins: { top: 0.1, bottom: 0.1 }
                },
                timeScale: {
                    borderColor: p.scale,
                    timeVisible: true,
                    secondsVisible: false
                }
            });
            this.areaSeries = this.chart.addSeries(AreaSeries, {
                topColor: p.top,
                bottomColor: p.bottom,
                lineColor: p.line,
                lineWidth: 2,
                priceFormat: {
                    type: 'custom',
                    formatter: (price: number) => `${(price * 100).toFixed(1)}%`
                }
            });
        }
        this.loadHistory();
    }

    private updateChartTheme(): void {
        if (!this.chart || !this.areaSeries) return;
        const p = this.palette();
        {
            this.chart?.applyOptions({
                layout: { background: { type: ColorType.Solid, color: p.background }, textColor: p.text },
                grid: {
                    vertLines: { color: p.grid, style: 1 },
                    horzLines: { color: p.grid, style: 1 }
                },
                crosshair: {
                    vertLine: { color: p.crosshair, labelBackgroundColor: p.crosshairLabel },
                    horzLine: { color: p.crosshair, labelBackgroundColor: p.crosshairLabel }
                },
                rightPriceScale: { borderColor: p.scale },
                timeScale: { borderColor: p.scale }
            });
            this.areaSeries?.applyOptions({
                topColor: p.top,
                bottomColor: p.bottom,
                lineColor: p.line
            });
        }
    }

    private teardownChart(): void {
        {
            if (this.tickRafId !== null) {
                cancelAnimationFrame(this.tickRafId);
                this.tickRafId = null;
            }
            this.pendingTick = null;
            if (this.areaSeries) {
                this.areaSeries.setData([]);
                this.areaSeries = null;
            }
            if (this.chart) {
                this.chart.remove();
                this.chart = null;
            }
        }
    }

    selectTimeframe(tf: ChartTimeframe): void {
        this.selectedTimeframe.set(tf);
        this.loadHistory();
    }

    /**
     * Loads the recorded trade history for the selected range. A response for an earlier request
     * (the reader changed range or market in the meantime) is ignored.
     */
    protected loadHistory(): void {
        const id = this.marketId();
        if (!id) return;

        const seq = ++this.requestSeq;
        this.historyState.set('loading');
        this.apiService
            .getMarketHistory(id, RANGE_FOR_TIMEFRAME[this.selectedTimeframe()])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (res) => {
                    if (seq === this.requestSeq) this.applyHistory(res);
                },
                error: () => {
                    if (seq !== this.requestSeq) return;
                    this.clearSeries();
                    this.historyState.set('error');
                }
            });
    }

    private applyHistory(res: MarketHistoryResponse): void {
        const data: ChartPoint[] = [];
        for (const pt of res.points) {
            const value = parseFloat(pt.p);
            const time = Date.parse(pt.t);
            if (!Number.isNaN(value) && !Number.isNaN(time)) {
                data.push({ time: Math.floor(time / 1000) as UTCTimestamp, value });
            }
        }
        this.currentData = data;

        {
            this.areaSeries?.setData(data);
            if (data.length > 0) this.chart?.timeScale().fitContent();
        }

        this.tableRows.set(
            res.points
                .slice(-TABLE_ROW_LIMIT)
                .reverse()
                .map((pt) => ({ time: pt.t, probability: `${(parseFloat(pt.p) * 100).toFixed(1)}%` }))
        );

        if (data.length === 0) {
            this.hasChange.set(false);
            this.historyState.set('empty');
            return;
        }
        this.historyState.set('ready');
        this.hasChange.set(data.length >= 2);
        if (data.length >= 2) {
            this.priceChange.set((data[data.length - 1].value - data[0].value) * 100);
        }
    }

    private clearSeries(): void {
        this.currentData = [];
        this.tableRows.set([]);
        this.hasChange.set(false);
        this.areaSeries?.setData([]);
    }

    private onNewPriceTick(newProb: number, date: Date): void {
        if (this.currentProbability() !== newProb) {
            this.currentProbability.set(newProb);
        }
        if (this.historyState() === 'empty') {
            this.historyState.set('ready');
        }
        this.pendingTick = { prob: newProb, date };
        if (this.tickRafId === null) {
            {
                this.tickRafId = requestAnimationFrame(() => {
                    this.tickRafId = null;
                    if (!this.pendingTick) return;
                    const { prob, date: tickDate } = this.pendingTick;
                    this.pendingTick = null;

                    const nowSec = Math.floor(tickDate.getTime() / 1000);
                    const lastTime = this.currentData.length > 0 ? (this.currentData[this.currentData.length - 1].time as number) : 0;
                    const time = (nowSec >= lastTime ? nowSec : lastTime) as UTCTimestamp;

                    if (this.areaSeries) {
                        try {
                            const point: ChartPoint = { time, value: prob };
                            this.areaSeries.update(point);
                            if (this.currentData.length > 0) {
                                const first = this.currentData[0].value;
                                const newChange = (prob - first) * 100;
                                this.hasChange.set(true);
                                if (Math.abs(this.priceChange() - newChange) > 0.001) {
                                    this.priceChange.set(newChange);
                                }
                            }
                        } catch {
                            // Ignore non-critical timestamp collision
                        }
                    }
                });
            }
        }
    }
}
