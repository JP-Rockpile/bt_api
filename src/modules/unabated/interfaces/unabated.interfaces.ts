export interface SnapshotResponse {
  data: any;
  league_id: string;
  market_type: string;
  lastUpdated: string;
  fetched_at: string;
  success: boolean;
  messages: string[];
}

export interface BetTypeRaw {
  id: number;
  name: string;
  description?: string;
  betOn?: string;
  sides?: number;
  canDraw?: boolean;
  hasPoints?: boolean;
  selectionCount?: number;
  betRange?: string;
  isFuture?: boolean;
  modifiedOn?: string;
}

export interface MarketSourceRaw {
  id: string | number;
  name: string;
  type?: string;
  logoUrl?: string;
  thumbnailUrl?: string;
  siteUrl?: string;
  isActive?: boolean;
  statusId?: number;
  propsStatusId?: number;
  futuresStatusId?: number;
}

export interface MarketLineUpdate {
  marketId?: string;
  marketLineId: string;
  marketSourceId: string;
  points?: number;
  price?: number;
  sourcePrice?: number;
  sourceFormat?: number;
  statusId?: number;
  sequenceNumber?: number;
  edge?: number;
  disabled?: boolean;
  marketLineKey?: string;
  modifiedOn?: string;
}

export interface RealtimeMessage {
  leagueId: string;
  marketSourceGroup?: string;
  messageId: string;
  messageTimestamp: string;
  correlationId?: string;
  marketLines: MarketLineUpdate[];
}

export interface ParsedMarkets {
  moneyline: any[];
  spread: any[];
  total: any[];
}
