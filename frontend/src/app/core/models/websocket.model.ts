/**
 * Telemetry message types received from the BayesMarket WebSocket broker.
 */
export type WebSocketMessageType = 'PRICE_UPDATE' | 'TRADE_EVENT' | 'MARKET_RESOLVED' | 'MARKET_UPDATED' | 'MARKET_DELETED';

/**
 * Real-time spot price and virtual inventory update payload.
 */
export interface PriceUpdateEvent {
    type: 'PRICE_UPDATE';
    market_id: string;
    yes_price: string;
    no_price: string;
    reserves?: {
        yes: string;
        no: string;
    };
    total_volume_usdc?: string;
    timestamp: string;
}

/**
 * Confirmed trade execution receipt for live order tape and chart ticks.
 */
export interface TradeEvent {
    type: 'TRADE_EVENT';
    trade_id: string;
    market_id: string;
    trade_type: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    shares: string;
    price: string;
    amount_usdc: string;
    timestamp: string;
}

/**
 * Winning outcome declaration broadcast on market resolution.
 */
export interface MarketResolvedEvent {
    type: 'MARKET_RESOLVED';
    market_id: string;
    winning_outcome: 'YES' | 'NO';
    timestamp: string;
}

export interface MarketUpdatedEvent {
    type: 'MARKET_UPDATED';
    market_id: string;
    timestamp: string;
}

export interface MarketDeletedEvent {
    type: 'MARKET_DELETED';
    market_id: string;
    timestamp: string;
}

export type WebSocketMessage = PriceUpdateEvent | TradeEvent | MarketResolvedEvent | MarketUpdatedEvent | MarketDeletedEvent;

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
