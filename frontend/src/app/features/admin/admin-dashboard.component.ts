import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideShieldCheck, LucidePlus, LucideCircleCheck, LucidePencil, LucideSlidersVertical } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Market, EditableMarketStatus, EditMarketRequest } from '../../core/models/market.model';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { AdminCreateMarketComponent } from './admin-create-market.component';
import { AdminResolveMarketComponent } from './admin-resolve-market.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { BadgeComponent, BadgeVariant } from '../../shared/components/badge/badge.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { LabelComponent } from '../../shared/components/label/label.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { BrandIconComponent } from '../../shared/components/brand-icon/brand-icon.component';
import { handleRovingKeydown } from '../../core/utils/roving-focus';
import { newIdempotencyKey } from '../../core/utils/idempotency';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        DialogComponent,
        ButtonComponent,
        BadgeComponent,
        BrandIconComponent,
        InputComponent,
        LabelComponent,
        SelectComponent,
        TextareaComponent,
        AdminCreateMarketComponent,
        AdminResolveMarketComponent,
        LucideShieldCheck,
        LucidePlus,
        LucideCircleCheck,
        LucidePencil,
        LucideSlidersVertical
    ],
    template: `
        <div class="admin-container">
            <!-- Header Banner -->
            <div class="admin-header">
                <div class="header-left">
                    <div class="admin-badge-row">
                        <app-badge variant="outline" size="sm">
                            <svg lucideShieldCheck class="badge-icon" [size]="14" aria-hidden="true"></svg>
                            ADMIN CONSOLE
                        </app-badge>
                    </div>
                    <div class="admin-title-row">
                        <app-brand-icon [size]="32" [glow]="true"></app-brand-icon>
                        <h1 class="admin-title">Prediction Market Operations</h1>
                    </div>
                    <p class="admin-subtitle">
                        Administrative command center for prediction market lifecycle: create algorithmic binary contracts, edit live metadata, execute
                        permanent deletions, or settle mature markets.
                    </p>
                </div>
            </div>

            <!-- Workspace Tabs -->
            <div class="workspace-tabs" role="tablist" aria-label="Admin Operations" (keydown)="rovingKeydown($event, '[role=tab]')">
                <button
                    type="button"
                    role="tab"
                    class="tab-btn"
                    [class.active]="activeTab() === 'manage'"
                    [attr.aria-selected]="activeTab() === 'manage'"
                    [attr.tabindex]="activeTab() === 'manage' ? 0 : -1"
                    (click)="activeTab.set('manage')"
                >
                    <svg lucideSlidersVertical [size]="16" aria-hidden="true"></svg>
                    <span>Manage Markets ({{ allMarkets().length }})</span>
                </button>

                <button
                    type="button"
                    role="tab"
                    class="tab-btn"
                    [class.active]="activeTab() === 'create'"
                    [attr.aria-selected]="activeTab() === 'create'"
                    [attr.tabindex]="activeTab() === 'create' ? 0 : -1"
                    (click)="activeTab.set('create')"
                >
                    <svg lucidePlus [size]="16" aria-hidden="true"></svg>
                    <span>Create Prediction Market</span>
                </button>

                <button
                    type="button"
                    role="tab"
                    class="tab-btn"
                    [class.active]="activeTab() === 'resolve'"
                    [attr.aria-selected]="activeTab() === 'resolve'"
                    [attr.tabindex]="activeTab() === 'resolve' ? 0 : -1"
                    (click)="activeTab.set('resolve')"
                >
                    <svg lucideCircleCheck [size]="16" aria-hidden="true"></svg>
                    <span>Resolve Market</span>
                </button>
            </div>

            <!-- Tab 0: Manage Existing Markets (Edit / Delete) -->
            @if (activeTab() === 'manage') {
                <div class="tab-pane manage-markets-pane">
                    <div class="manage-header-row">
                        <div>
                            <h2 class="section-title">All Prediction Markets</h2>
                            <p class="section-desc">Every market in every status. Inspect status, edit parameters, or void and delete markets.</p>
                        </div>
                        <div class="manage-header-actions">
                            <app-button variant="outline" size="sm" (btnClick)="loadMarkets()" ariaLabel="Refresh markets list"> Refresh List </app-button>
                            <app-button variant="primary" size="sm" (btnClick)="activeTab.set('create')" ariaLabel="Create new market">
                                <svg lucidePlus [size]="14" aria-hidden="true"></svg>
                                <span>Create Market</span>
                            </app-button>
                        </div>
                    </div>

                    @if (allMarkets().length === 0) {
                        <div class="empty-markets-card">
                            <div class="empty-icon-circle">
                                <svg lucideSlidersVertical [size]="32" aria-hidden="true"></svg>
                            </div>
                            <h3 class="empty-title">No Markets Yet</h3>
                            <p class="empty-desc">Use the creation form to deploy your first prediction market.</p>
                            <app-button variant="primary" size="default" (btnClick)="activeTab.set('create')" ariaLabel="Create first market">
                                <svg lucidePlus [size]="16" aria-hidden="true"></svg>
                                <span>Create Prediction Market</span>
                            </app-button>
                        </div>
                    } @else {
                        <div class="markets-table-container">
                            <table class="markets-table" role="table">
                                <thead>
                                    <tr>
                                        <th>Market Question</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Resolution Date</th>
                                        <th>Volume</th>
                                        <th>Probability</th>
                                        <th class="th-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (m of allMarkets(); track m.id) {
                                        <tr>
                                            <td class="td-market">
                                                <div class="market-cell-title">
                                                    <a [routerLink]="'/markets/' + m.slug" class="table-market-link" target="_blank" rel="noopener">
                                                        {{ m.title }}
                                                    </a>
                                                    <span class="market-cell-id mono-sub">ID: {{ m.id.slice(0, 8) }}...</span>
                                                </div>
                                            </td>
                                            <td>
                                                <app-badge variant="outline" size="sm">{{ m.category | uppercase }}</app-badge>
                                            </td>
                                            <td>
                                                <app-badge [variant]="getStatusBadgeVariant(m.status)" size="sm">
                                                    {{ m.status | uppercase }}
                                                </app-badge>
                                            </td>
                                            <td class="tabular-nums mono-sub">
                                                {{ m.resolution_date | date: 'mediumDate' }}
                                            </td>
                                            <td class="tabular-nums mono-sub">&#36;{{ m.reserves.total_volume_usdc || '0' }}</td>
                                            <td class="tabular-nums prob-cell">
                                                <span class="prob-yes">▲ {{ m.probability_yes_pct }}</span>
                                                <span class="prob-sep">/</span>
                                                <span class="prob-no">▼ {{ m.probability_no_pct }}</span>
                                            </td>
                                            <td class="td-actions">
                                                <div class="action-buttons-group">
                                                    <app-button
                                                        variant="secondary"
                                                        size="sm"
                                                        [disabled]="isTerminal(m)"
                                                        (btnClick)="openEditModal(m)"
                                                        ariaLabel="Edit market {{ m.title }}"
                                                    >
                                                        <svg lucidePencil [size]="14" aria-hidden="true"></svg>
                                                        <span>Edit</span>
                                                    </app-button>
                                                    <app-button
                                                        variant="destructive"
                                                        size="sm"
                                                        [disabled]="isTerminal(m)"
                                                        (btnClick)="openVoidModal(m)"
                                                        ariaLabel="Void market {{ m.title }} and refund open positions"
                                                    >
                                                        <span>Void</span>
                                                    </app-button>
                                                </div>
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    }
                </div>
            }

            <!-- Tab 1: Create Market View -->
            @if (activeTab() === 'create') {
                <app-admin-create-market [categories]="categoryOptions()" (created)="loadMarkets()" />
            }
            <!-- Tab 2: Resolve Market View -->
            @if (activeTab() === 'resolve') {
                <app-admin-resolve-market [markets]="allMarkets()" (resolved)="loadMarkets()" />
            }
            <!-- Edit Market Modal Dialog -->
            <app-dialog
                [open]="!!editingMarket()"
                (closed)="closeEditModal()"
                title="Edit Prediction Market"
                description="Modify market question, status, or resolution criteria."
                size="lg"
                dialogRole="dialog"
                ariaLabel="Edit Prediction Market Dialog"
            >
                @if (editingMarket(); as em) {
                    <form class="market-form" (submit)="onSubmitEditMarket($event)">
                        <div class="form-group">
                            <app-label htmlFor="edit-title">Market Question / Title *</app-label>
                            <app-input id="edit-title" [value]="editTitle()" (valueChange)="onValueChange(editTitle, $event)" ariaLabel="Edit Market Title" />
                        </div>

                        <div class="form-row-2">
                            <div class="form-group">
                                <app-label htmlFor="edit-category">Category *</app-label>
                                <app-select
                                    id="edit-category"
                                    [options]="categoryOptions()"
                                    [value]="editCategory()"
                                    (valueChange)="editCategory.set($event)"
                                    ariaLabel="Edit Market Category"
                                />
                            </div>
                            <div class="form-group">
                                <app-label htmlFor="edit-status">Status *</app-label>
                                <app-select
                                    id="edit-status"
                                    [options]="statusOptions"
                                    [value]="editStatus()"
                                    (valueChange)="onStatusChange($event)"
                                    ariaLabel="Edit Market Status"
                                />
                            </div>
                        </div>

                        <div class="form-group">
                            <app-label htmlFor="edit-date">Resolution Date (your local time) *</app-label>
                            <app-input
                                id="edit-date"
                                type="datetime-local"
                                variant="mono"
                                [value]="editResolutionDateInput()"
                                (valueChange)="onValueChange(editResolutionDateInput, $event)"
                                ariaLabel="Edit Resolution Date"
                            />
                        </div>

                        <div class="form-group">
                            <app-label htmlFor="edit-desc">Detailed Resolution Criteria *</app-label>
                            <app-textarea
                                id="edit-desc"
                                [rows]="3"
                                [value]="editDescription()"
                                (valueChange)="editDescription.set($event)"
                                ariaLabel="Edit Description"
                            />
                        </div>

                        <div class="form-group">
                            <app-label htmlFor="edit-source">Authoritative Resolution Source *</app-label>
                            <app-input
                                id="edit-source"
                                [value]="editResolutionSource()"
                                (valueChange)="onValueChange(editResolutionSource, $event)"
                                ariaLabel="Edit Resolution Source"
                            />
                        </div>

                        <div class="dialog-actions">
                            <app-button variant="outline" size="default" type="button" (btnClick)="closeEditModal()" ariaLabel="Cancel editing">
                                Cancel
                            </app-button>
                            <app-button
                                variant="primary"
                                size="default"
                                type="submit"
                                [loading]="isEditingSubmitting()"
                                (btnClick)="onSubmitEditMarket($event)"
                                ariaLabel="Save market changes"
                            >
                                Save Changes
                            </app-button>
                        </div>
                    </form>
                }
            </app-dialog>

            <!-- Void Confirmation Modal -->
            <app-dialog
                [open]="!!voidingMarket()"
                (closed)="closeVoidModal()"
                title="Void Prediction Market"
                description="Cancel this market and refund every open position at cost basis."
                size="sm"
                dialogRole="alertdialog"
                ariaLabel="Void Prediction Market Alert"
            >
                @if (voidingMarket(); as vm) {
                    <div class="delete-body">
                        <div class="delete-market-preview">
                            <span class="preview-label">Market Question:</span>
                            <strong class="preview-title">{{ vm.title }}</strong>
                            <span class="mono-sub">ID: {{ vm.id }}</span>
                        </div>
                        <div class="danger-box">
                            <p class="danger-text">
                                Void &amp; Refund cancels the market and returns each open position's cost basis to its holder. Trade and ledger history is
                                kept. A voided market can't be traded, edited or resolved again.
                            </p>
                        </div>

                        <div class="dialog-actions">
                            <app-button variant="outline" size="default" type="button" (btnClick)="closeVoidModal()" ariaLabel="Cancel void">
                                Cancel
                            </app-button>
                            <app-button
                                variant="destructive"
                                size="default"
                                type="button"
                                [loading]="isVoidingSubmitting()"
                                (btnClick)="confirmVoidMarket()"
                                ariaLabel="Void market and refund open positions"
                            >
                                Void &amp; Refund
                            </app-button>
                        </div>
                    </div>
                }
            </app-dialog>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                min-height: calc(100vh - 60px);
                background-color: var(--canvas);
                color: var(--ink);
                padding: var(--space-xl) var(--space-lg) 80px;
            }

            .admin-container {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: var(--space-xl);
            }

            .admin-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: var(--space-md);
                border-bottom: 1px solid var(--hairline);
                padding-bottom: var(--space-xl);
            }

            .admin-badge-row,
            .admin-title-row,
            .manage-header-actions,
            .prob-cell,
            .action-buttons-group,
            .dialog-actions,
            .success-header,
            .res-summary-title,
            .workspace-tabs,
            .prob-split-labels,
            .view-market-link {
                display: flex;
                align-items: center;
            }

            .admin-badge-row {
                gap: var(--space-xs);
                margin-bottom: var(--space-xs);
            }

            .badge-icon {
                margin-right: var(--space-xxs);
                color: var(--primary-border);
            }

            .admin-title-row {
                gap: var(--space-sm);
                margin-bottom: var(--space-xs);
            }

            .admin-title {
                font-size: 28px;
                font-weight: 800;
                color: var(--ink);
                margin: 0;
                letter-spacing: var(--letter-spacing-heading);
            }

            .admin-subtitle {
                font-size: 14px;
                color: var(--muted);
                max-width: 720px;
                line-height: var(--line-height-prose);
                margin: 0;
            }

            /* Common Card Containers */
            .gatekeeper-card,
            .form-card,
            .preview-card,
            .markets-table-container,
            .empty-markets-card {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
            }

            .card-title,
            .section-title,
            .preview-title,
            .empty-title {
                font-size: 18px;
                font-weight: 700;
                color: var(--ink);
                margin: 0;
            }

            .section-title {
                font-size: 20px;
                margin-bottom: var(--space-xxs);
            }

            .section-desc,
            .card-desc,
            .preview-subtitle,
            .empty-desc {
                font-size: 13px;
                color: var(--muted);
                margin: 0;
            }

            /* Workspace Tabs */
            .workspace-tabs {
                gap: var(--space-xs);
                border-bottom: 1px solid var(--hairline);
                padding-bottom: var(--space-xs);
                flex-wrap: wrap;
            }

            .tab-btn {
                display: inline-flex;
                align-items: center;
                gap: var(--space-xs);
                min-height: var(--touch-target-min);
                padding: var(--space-xs) var(--space-md);
                border-radius: var(--radius-md);
                background-color: transparent;
                border: 1px solid transparent;
                color: var(--muted);
                font-family: var(--font-ui);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition:
                    color 0.15s ease,
                    background-color 0.15s ease,
                    border-color 0.15s ease;
            }

            .tab-btn:hover {
                background-color: var(--surface-card);
                color: var(--ink);
            }

            .tab-btn.active {
                background-color: var(--surface-card-elevated);
                color: var(--ink);
                border-color: var(--hairline);
                font-weight: 700;
            }

            /* Manage Markets Tab */
            .manage-markets-pane {
                display: flex;
                flex-direction: column;
                gap: var(--space-lg);
            }

            .manage-header-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-md);
                flex-wrap: wrap;
            }

            .manage-header-actions {
                gap: var(--space-xs);
            }

            .empty-markets-card {
                border-style: dashed;
                padding: var(--space-section) var(--space-xl);
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-sm);
            }

            .empty-icon-circle {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background-color: var(--primary-subtle);
                color: var(--primary);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .empty-desc {
                max-width: 440px;
                margin-bottom: var(--space-xs);
            }

            .markets-table-container {
                overflow-x: auto;
            }

            .markets-table {
                width: 100%;
                border-collapse: collapse;
                text-align: left;
                font-size: 13px;
            }

            .markets-table th {
                padding: 14px var(--space-md);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--muted);
                border-bottom: 1px solid var(--hairline);
                background-color: var(--canvas-subtle);
            }

            .markets-table td {
                padding: 14px var(--space-md);
                border-bottom: 1px solid var(--hairline);
                color: var(--ink);
                vertical-align: middle;
            }

            .markets-table tbody tr:hover {
                background-color: var(--canvas-subtle);
            }

            .td-market {
                max-width: 320px;
            }

            .market-cell-title {
                display: flex;
                flex-direction: column;
                gap: var(--space-xxs);
            }

            .table-market-link {
                color: var(--ink);
                font-weight: 600;
                text-decoration: none;
                transition: color 0.15s ease;
            }

            .table-market-link:hover {
                color: var(--link);
                text-decoration: underline;
            }

            .mono-sub {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--muted);
            }

            .prob-cell {
                font-family: var(--font-mono);
                font-weight: 700;
                gap: var(--space-xxs);
            }

            .prob-yes {
                color: var(--outcome-yes);
            }

            .prob-sep {
                color: var(--hairline);
            }

            .prob-no {
                color: var(--outcome-no);
            }

            .th-actions,
            .td-actions {
                text-align: right;
            }

            .action-buttons-group {
                gap: var(--space-xs);
                justify-content: flex-end;
            }

            /* Create Market Layout */
            .create-market-grid {
                display: grid;
                grid-template-columns: 3fr 2fr;
                gap: var(--space-xl);
            }

            @media (max-width: 900px) {
                .create-market-grid {
                    grid-template-columns: 1fr;
                }
            }

            .form-card {
                padding: var(--space-xl);
                display: flex;
                flex-direction: column;
                gap: var(--space-md);
            }

            .market-form {
                display: flex;
                flex-direction: column;
                gap: var(--space-md);
            }

            .form-group {
                display: flex;
                flex-direction: column;
                gap: var(--space-xxs);
            }

            .form-row-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-md);
            }

            @media (max-width: 600px) {
                .form-row-2 {
                    grid-template-columns: 1fr;
                }
            }

            .form-actions {
                margin-top: var(--space-xs);
            }

            /* Preview Column */
            .preview-column {
                display: flex;
                flex-direction: column;
                gap: var(--space-lg);
            }

            .preview-card {
                padding: var(--space-lg);
                display: flex;
                flex-direction: column;
                gap: var(--space-md);
            }

            .prob-visual-track {
                width: 100%;
                height: 10px;
                border-radius: var(--radius-pill);
                display: flex;
                overflow: hidden;
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
            }

            .track-yes {
                background-color: var(--outcome-yes);
                transition: width 0.2s ease;
            }

            .track-no {
                background-color: var(--outcome-no);
                transition: width 0.2s ease;
            }

            .prob-split-labels {
                justify-content: space-between;
                font-family: var(--font-mono);
                font-size: 12px;
                font-weight: 700;
            }

            .label-yes {
                color: var(--outcome-yes);
            }

            .label-no {
                color: var(--outcome-no);
            }

            .preview-stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-xs);
                border-top: 1px solid var(--hairline);
                padding-top: var(--space-sm);
            }

            .stat-box {
                display: flex;
                flex-direction: column;
                gap: var(--space-xxs);
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: var(--space-xs) var(--space-sm);
            }

            .stat-k {
                font-size: 11px;
                color: var(--muted);
            }

            .stat-v {
                font-family: var(--font-mono);
                font-size: 13px;
                font-weight: 700;
                color: var(--ink);
                font-feature-settings: 'tnum' 1;
            }

            .info-alert {
                display: flex;
                align-items: flex-start;
                gap: var(--space-xs);
                padding: var(--space-xs) var(--space-sm);
                background-color: var(--status-info-bg);
                border: 1px solid var(--status-info-border);
                border-radius: var(--radius-md);
                font-size: 12px;
                color: var(--status-info);
                line-height: var(--line-height-prose);
            }

            .info-icon {
                color: var(--status-info);
                flex-shrink: 0;
                margin-top: 2px;
            }

            .success-banner {
                background-color: var(--status-profit-bg);
                border: 1px solid var(--status-profit-border);
                border-radius: var(--radius-lg);
                padding: var(--space-md) var(--space-lg);
                display: flex;
                flex-direction: column;
                gap: var(--space-xs);
            }

            .success-header {
                gap: var(--space-xs);
            }

            .success-icon {
                color: var(--status-profit);
            }

            .success-title {
                font-size: 14px;
                font-weight: 700;
                color: var(--status-profit);
            }

            .success-text {
                font-size: 13px;
                color: var(--ink);
                margin: 0;
            }

            .view-market-link {
                gap: var(--space-xxs);
                color: var(--link);
                font-size: 13px;
                font-weight: 600;
                text-decoration: none;
            }

            .view-market-link:hover {
                color: var(--link-active);
                text-decoration: underline;
            }

            /* Resolve Market Pane */
            .resolve-card {
                max-width: 640px;
            }

            .outcome-select-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-sm);
            }

            .outcome-glyph {
                margin-right: var(--space-xxs);
            }

            .resolution-summary-box {
                margin-top: var(--space-md);
                padding: var(--space-md);
                background-color: var(--status-profit-bg);
                border: 1px solid var(--status-profit-border);
                border-radius: var(--radius-md);
                display: flex;
                flex-direction: column;
                gap: var(--space-sm);
            }

            .res-summary-title {
                gap: var(--space-xs);
                font-size: 14px;
                font-weight: 700;
                color: var(--status-profit);
            }

            .res-stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: var(--space-xs);
            }

            .res-stat {
                display: flex;
                flex-direction: column;
                gap: var(--space-xxs);
            }

            .res-audit-section {
                display: flex;
                flex-direction: column;
                gap: var(--space-xs);
                padding-top: var(--space-sm);
                border-top: 1px solid var(--hairline);
            }

            .res-audit-row {
                display: flex;
                flex-direction: column;
                gap: var(--space-xxs);
            }

            .audit-digest-val {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--ink-secondary);
                word-break: break-all;
                background-color: var(--surface-terminal);
                padding: var(--space-xxs) var(--space-xs);
                border-radius: var(--radius-xs);
                border: 1px solid var(--hairline);
            }

            .resolve-early-row {
                display: flex;
                align-items: center;
                gap: var(--space-sm);
                min-height: 44px;
            }

            .field-hint {
                margin: 0;
                font-size: 13px;
                color: var(--muted);
            }

            /* Dialog actions and Delete Body */
            .dialog-actions {
                justify-content: flex-end;
                gap: var(--space-xs);
                margin-top: var(--space-md);
            }

            .delete-body {
                display: flex;
                flex-direction: column;
                gap: var(--space-md);
            }

            .delete-warning-text {
                font-size: 14px;
                color: var(--ink);
                margin: 0;
            }

            .delete-market-preview {
                display: flex;
                flex-direction: column;
                gap: var(--space-xxs);
                padding: var(--space-xs) var(--space-sm);
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
            }

            .preview-label {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--muted);
            }

            .danger-box {
                padding: var(--space-xs) var(--space-sm);
                background-color: var(--status-loss-bg);
                border: 1px solid var(--status-loss-border);
                border-radius: var(--radius-md);
            }

            .danger-text {
                font-size: 12px;
                color: var(--status-loss);
                margin: 0;
                line-height: var(--line-height-prose);
            }
        `
    ]
})
export class AdminDashboardComponent implements OnInit {
    protected readonly rovingKeydown = handleRovingKeydown;
    private readonly apiService = inject(ApiService);
    private readonly toastService = inject(ToastService);
    readonly authStore = inject(AuthStore);

    readonly isEditingSubmitting = signal<boolean>(false);
    readonly isVoidingSubmitting = signal<boolean>(false);
    readonly isDev = signal<boolean>(typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

    readonly activeTab = signal<'manage' | 'create' | 'resolve'>('manage');

    // Every market in every status, from the admin list endpoint
    readonly allMarkets = signal<Market[]>([]);

    // Edit Market Modal fields
    readonly editingMarket = signal<Market | null>(null);
    readonly editTitle = signal<string>('');
    readonly editCategory = signal<string>('ai');
    readonly editStatus = signal<EditableMarketStatus>('active');
    readonly editResolutionDateInput = signal<string>('');
    readonly editDescription = signal<string>('');
    readonly editResolutionSource = signal<string>('');

    // Void Market Modal fields
    readonly voidingMarket = signal<Market | null>(null);
    // Generated once per opened dialog so a retried void replays instead of executing twice
    private voidIdempotencyKey = '';

    constructor() {
        // Auto-load markets whenever admin permissions are active
        effect(() => {
            if (this.authStore.isAdmin()) {
                this.loadMarkets();
            }
        });
    }

    onValueChange(targetSignal: WritableSignal<string>, val: string | number): void {
        targetSignal.set(String(val ?? ''));
    }

    onStatusChange(val: string): void {
        if (val === 'active' || val === 'suspended' || val === 'locked') {
            this.editStatus.set(val);
        }
    }

    /** Categories from the server (GET /api/v1/categories); the same list creation validates against. */
    readonly categoryOptions = signal<SelectOption[]>([]);

    readonly statusOptions: SelectOption[] = [
        { value: 'active', label: 'Active (Trading Open)' },
        { value: 'suspended', label: 'Suspended (Trading Halted)' },
        { value: 'locked', label: 'Locked (Awaiting Resolution)' }
    ];

    getStatusBadgeVariant(status: string): BadgeVariant {
        switch (status) {
            case 'active':
                return 'profit';
            case 'suspended':
            case 'locked':
                return 'warning';
            case 'resolved':
                return 'resolved';
            case 'voided':
                return 'secondary';
            default:
                return 'outline';
        }
    }

    /** Resolved and voided markets are final: they can't be edited, voided, deleted or resolved. */
    isTerminal(m: Market): boolean {
        return m.status === 'resolved' || m.status === 'voided';
    }

    private getEffectiveToken(): string | null {
        return this.authStore.token();
    }

    ngOnInit(): void {
        this.apiService.getMarketCategories().subscribe({
            next: (list) => this.categoryOptions.set(list.map((c) => ({ value: c.id, label: c.label }))),
            error: () => this.toastService.warning('Categories unavailable', 'Could not load the market category list.')
        });

        if (this.authStore.isAdmin()) {
            this.loadMarkets();
        }
    }

    private formatForDateTimeLocal(isoDateStr?: string): string {
        if (!isoDateStr) return '';
        const d = new Date(isoDateStr);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day}T${hours}:${minutes}`;
    }

    loadMarkets(): void {
        this.apiService.getAdminMarkets(this.getEffectiveToken()).subscribe({
            next: (markets) => {
                this.allMarkets.set(markets);
            },
            error: (err) => console.warn('Failed to load markets:', err)
        });
    }

    // --- Market Editing ---
    openEditModal(m: Market): void {
        this.editingMarket.set(m);
        this.editTitle.set(m.title);
        this.editCategory.set(m.category);
        this.editStatus.set(m.status === 'suspended' || m.status === 'locked' ? m.status : 'active');
        this.editResolutionDateInput.set(this.formatForDateTimeLocal(m.resolution_date));
        this.editDescription.set(m.description || '');
        this.editResolutionSource.set(m.resolution_source || '');
    }

    closeEditModal(): void {
        this.editingMarket.set(null);
    }

    onSubmitEditMarket(e: Event): void {
        e.preventDefault();
        const m = this.editingMarket();
        if (!m) return;

        const title = this.editTitle().trim();
        const desc = this.editDescription().trim();
        const source = this.editResolutionSource().trim();
        const rawDate = this.editResolutionDateInput().trim();

        if (!title || !desc || !source || !rawDate) {
            this.toastService.warning('Validation Error', 'Please complete all required fields');
            return;
        }

        const payload: EditMarketRequest = {
            title,
            description: desc,
            category: this.editCategory(),
            resolution_source: source,
            resolution_date: new Date(rawDate).toISOString(),
            status: this.editStatus()
        };

        this.isEditingSubmitting.set(true);
        this.apiService.editMarket(m.id, payload, this.getEffectiveToken()).subscribe({
            next: (updated) => {
                this.isEditingSubmitting.set(false);
                this.closeEditModal();
                this.toastService.success('Market Updated', `"${updated.title}" successfully updated!`);
                this.loadMarkets();
            },
            error: (err) => {
                this.isEditingSubmitting.set(false);
                const msg = err?.error?.message || 'Failed to update market';
                this.toastService.error('Update Error', msg);
            }
        });
    }

    // --- Market Voiding ---
    openVoidModal(m: Market): void {
        this.voidIdempotencyKey = newIdempotencyKey(`void-${m.id}`);
        this.voidingMarket.set(m);
    }

    closeVoidModal(): void {
        this.voidingMarket.set(null);
    }

    confirmVoidMarket(): void {
        const m = this.voidingMarket();
        if (!m) return;

        this.isVoidingSubmitting.set(true);
        this.apiService.voidMarket(m.id, this.getEffectiveToken(), this.voidIdempotencyKey).subscribe({
            next: (res) => {
                this.isVoidingSubmitting.set(false);
                this.closeVoidModal();
                this.toastService.success(
                    'Market Voided',
                    `"${m.title}" was voided. Refunded ${res.total_refund_usdc} USDC across ${res.positions_refunded} positions.`
                );
                this.loadMarkets();
            },
            error: (err) => {
                this.isVoidingSubmitting.set(false);
                const msg = err?.error?.message || 'Failed to void market';
                this.toastService.error('Void Error', msg);
            }
        });
    }
}
