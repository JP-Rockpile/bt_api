/**
 * Central re-export of shared types for use across the API
 *
 * This file provides a single import point for all shared types,
 * making it easy to maintain consistency across the codebase.
 *
 * Updated for @betthink/shared v0.2.0
 */

// Core domain types
export type {
  // Sports & Events
  Sport,
  League,
  Event,
  Team,
  Participant,
  Venue,
  ExternalIdentifiers,

  // Markets & Odds
  Market,
  MarketParameters,
  Odds,
  OddsOffer,
  BestOdds,
  OddsMovement,
  ClosingLineValue,

  // Bets
  Bet,
  BetLeg,
  BetPlan,
  BetConfirmation,
  BetSettlement,
  BetAuditEntry,
  Selection,
  SelectionData,
  SelectionResult,

  // Users
  User,
  UserProfile,
  UserPreferences,
  RiskSettings,
  NotificationPreferences,
  LinkedSportsbookAccount,

  // Sportsbooks
  Sportsbook,
  SportsbookFeatures,
  SportsbookIntegration,
  Promotion,
  CommissionStructure,
  DeepLinkCapabilities,

  // Chat/Messages (Core)
  Conversation,
  Message,
  MessageContext,
  MessageAttachment,
  MessageReaction,
  TypingIndicator,
  StreamingEvent,

  // Chat/Messages (Mobile - v0.2.0)
  ChatMessage,
  LocalChatMessage,
  MessageMetadata,
  ChatThread,
  ChatHistoryResponse,
  ConversationListResponse,

  // Server-Sent Events (v0.2.0)
  SSEEvent,
  StreamChunk,
  ChatSSEEvent,
  ChatSSEEventType,
  BaseChatSSEEvent,
  ConnectedEvent,
  HeartbeatEvent,
  LLMChunkEvent,
  LLMCompleteEvent,
  SystemEvent,
  ErrorEvent,

  // Notifications (v0.2.0)
  PushNotification,
  NotificationType,
  DeviceToken,
  DevicePlatform,

  // Analytics (v0.2.0)
  AnalyticsEvent,
  EventName,

  // Synchronization (v0.2.0)
  SyncStatus,

  // Common types
  AmericanOdds,
  DecimalOdds,
  FractionalOdds,
  ImpliedProbability,
  MoneyAmount,
  Percentage,
  DateRange,
  TimeWindow,
  Geolocation,
  Address,
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
  SearchParams,
  SortParams,
  FilterCondition,
  ApiResponse,
  ApiError,
  Result,
} from '@betthink/shared';

// Enums
export {
  SportId,
  LeagueId,
  MarketType,
  MarketCategory,
  OddsFormat,
  BetStatus,
  BetType,
  SelectionType,
  EventStatus,
  SeasonType,
  Region,
  MessageRole,
  MessageIntent,
  ContentType,
  StreamingEventType,
  ErrorCode,
  FilterOperator,
  PromotionType,
} from '@betthink/shared';

// Type guards and utility types
export type { OptionalWithReason } from '@betthink/shared';
