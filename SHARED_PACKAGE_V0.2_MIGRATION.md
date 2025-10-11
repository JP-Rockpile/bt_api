# Migration Guide: @betthink/shared v0.1.0 → v0.2.0

## ✅ Status: COMPLETED

The BetThink API has been successfully updated to `@betthink/shared` v0.2.0 with **NO BREAKING CHANGES**.

## 🎯 Summary

Version 0.2.0 adds comprehensive mobile application support with:
- Offline-first chat capabilities
- Real-time Server-Sent Events (SSE)
- Push notifications
- Analytics tracking
- Additional utility functions

All changes are **backwards compatible** - existing code continues to work without modifications.

## 📦 What's New in v0.2.0

### 1. Mobile Chat & Messaging

#### New Types

**`ChatMessage`** - Simplified message structure for mobile UI
```typescript
import { ChatMessage } from '@betthink/shared';

const message: ChatMessage = {
  id: 'msg_123',
  chatId: 'chat_456',
  role: 'user',
  content: 'Should I bet on the Lakers tonight?',
  timestamp: '2025-10-11T12:00:00Z',
  metadata: {
    betRecommendation: { /* ... */ },
    tokensUsed: 150,
  },
};
```

**`LocalChatMessage`** - Offline-first message with sync tracking
```typescript
import { LocalChatMessage, SyncStatus } from '@betthink/shared';

const localMessage: LocalChatMessage = {
  ...message,
  localId: 'local_abc',
  synced: false,
  optimistic: true,
};
```

**`ConversationListResponse`** - Paginated conversation listing
```typescript
import { ConversationListResponse } from '@betthink/shared';

const response: ConversationListResponse = {
  conversations: [
    {
      id: 'conv_123',
      userId: 'user_456',
      title: 'Lakers Betting Strategy',
      createdAt: '2025-10-11T12:00:00Z',
      updatedAt: '2025-10-11T14:30:00Z',
      lastMessageAt: '2025-10-11T14:30:00Z',
      messageCount: 15,
      metadata: null,
    },
  ],
  total: 25,
  page: 1,
  limit: 10,
  hasMore: true,
};
```

### 2. Server-Sent Events (SSE)

#### Real-time Streaming Types

**`ChatSSEEvent`** - Type-safe SSE events
```typescript
import { ChatSSEEvent, ChatSSEEventType } from '@betthink/shared';

// Discriminated union for type safety
function handleSSEEvent(event: ChatSSEEvent) {
  switch (event.event) {
    case 'connected':
      console.log(`Session: ${event.sessionId}`);
      break;
    
    case 'llm_chunk':
      console.log(`Chunk: ${event.chunk}`);
      break;
    
    case 'llm_complete':
      console.log(`Done. Tokens: ${event.tokensUsed}`);
      break;
    
    case 'error':
      console.error(`Error: ${event.error}`);
      break;
  }
}
```

**Event Types:**
- `ConnectedEvent` - Connection established
- `HeartbeatEvent` - Keep-alive ping
- `LLMChunkEvent` - Streaming LLM response chunk
- `LLMCompleteEvent` - LLM response complete
- `SystemEvent` - System messages
- `ErrorEvent` - Error notifications

#### Example SSE Controller
```typescript
import { ChatSSEEvent } from '@betthink/shared';
import { Observable } from 'rxjs';

@Controller('chat')
export class ChatController {
  @Get('stream')
  @Sse()
  stream(@Query('chatId') chatId: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      // Send connected event
      const connectedEvent: ChatSSEEvent = {
        event: 'connected',
        data: { sessionId: 'session_123' },
        sessionId: 'session_123',
        timestamp: new Date().toISOString(),
      };
      observer.next({ data: connectedEvent });

      // Stream LLM chunks
      const chunks = ['The ', 'Lakers ', 'are ', 'favored...'];
      chunks.forEach((chunk, i) => {
        const chunkEvent: ChatSSEEvent = {
          event: 'llm_chunk',
          data: { chunk, index: i },
          chunk,
          index: i,
        };
        observer.next({ data: chunkEvent });
      });

      // Send complete event
      const completeEvent: ChatSSEEvent = {
        event: 'llm_complete',
        data: { messageId: 'msg_123', tokensUsed: 150 },
        messageId: 'msg_123',
        tokensUsed: 150,
      };
      observer.next({ data: completeEvent });
    });
  }
}
```

### 3. Push Notifications

#### New Types

**`PushNotification`** - Push notification entity
```typescript
import { PushNotification, NotificationType } from '@betthink/shared';

const notification: PushNotification = {
  id: 'notif_123',
  userId: 'user_456',
  type: 'bet_result',
  title: 'Bet Won! 🎉',
  body: 'Your Lakers bet won $50!',
  data: {
    betId: 'bet_789',
    result: 'won',
    profit: 50,
  },
  sent: true,
  sentAt: '2025-10-11T20:00:00Z',
  read: false,
  createdAt: '2025-10-11T20:00:00Z',
};
```

**`DeviceToken`** - Device registration
```typescript
import { DeviceToken, DevicePlatform } from '@betthink/shared';

const device: DeviceToken = {
  id: 'device_123',
  userId: 'user_456',
  token: 'ExponentPushToken[xxxxxxxxxxxxxx]',
  platform: 'ios',
  active: true,
  lastUsed: '2025-10-11T12:00:00Z',
  createdAt: '2025-10-10T12:00:00Z',
};
```

**Notification Types:**
- `bet_result` - Bet outcome notifications
- `bet_reminder` - Reminder to place bet
- `chat_message` - New chat message
- `system_alert` - System announcements

### 4. Analytics Events

**`AnalyticsEvent`** - User behavior tracking
```typescript
import { AnalyticsEvent, EventName } from '@betthink/shared';

const event: AnalyticsEvent = {
  id: 'event_123',
  userId: 'user_456',
  sessionId: 'session_789',
  eventName: 'bet_placed',
  eventData: {
    betId: 'bet_abc',
    stake: 50,
    odds: -110,
    sportsbookId: 'draftkings',
  },
  timestamp: '2025-10-11T14:30:00Z',
  deviceInfo: {
    platform: 'ios',
    appVersion: '1.0.0',
  },
};
```

**Available Event Names:**
- `chat_message_sent`
- `chat_session_started`
- `bet_planned`
- `bet_placed`
- `bet_confirmed`
- `deep_link_opened`
- `odds_compared`
- `event_viewed`
- `sportsbook_linked`
- `push_notification_opened`
- `screen_view`
- `connection_established`
- `connection_lost`
- `error_occurred`

### 5. New Utility Functions

#### Date/Time

**`formatRelativeTime()`** - Human-readable timestamps
```typescript
import { formatRelativeTime } from '@betthink/shared';

formatRelativeTime('2025-10-11T14:30:00Z'); // "just now"
formatRelativeTime('2025-10-11T14:25:00Z'); // "5m ago"
formatRelativeTime('2025-10-11T11:30:00Z'); // "3h ago"
formatRelativeTime('2025-10-10T14:30:00Z'); // "1d ago"
```

#### String Manipulation

**`truncate()`** - Truncate strings with ellipsis
```typescript
import { truncate } from '@betthink/shared';

truncate('This is a very long message', 20); // "This is a very lo..."
truncate('Short', 20); // "Short"
```

**`capitalize()`** - Capitalize first character
```typescript
import { capitalize } from '@betthink/shared';

capitalize('hello world'); // "Hello world"
```

#### Validation

**`isValidEmail()`** - Email validation
```typescript
import { isValidEmail } from '@betthink/shared';

isValidEmail('user@example.com'); // true
isValidEmail('invalid-email'); // false
```

**`isValidUUID()`** - UUID validation
```typescript
import { isValidUUID } from '@betthink/shared';

isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
isValidUUID('not-a-uuid'); // false
```

#### Async & Retry

**`sleep()`** - Promise-based delay
```typescript
import { sleep } from '@betthink/shared';

await sleep(1000); // Wait 1 second
```

**`exponentialBackoff()`** - Calculate backoff delays
```typescript
import { exponentialBackoff } from '@betthink/shared';

for (let attempt = 0; attempt < 5; attempt++) {
  try {
    await apiCall();
    break;
  } catch (error) {
    const delay = exponentialBackoff(attempt);
    await sleep(delay);
  }
}
// Delays: 1s, 2s, 4s, 8s, 16s (capped at 30s)
```

#### Platform Detection

**`isIOS()` & `isAndroid()`** - Device detection
```typescript
import { isIOS, isAndroid } from '@betthink/shared';

if (isIOS()) {
  // iOS-specific logic
}

if (isAndroid()) {
  // Android-specific logic
}
```

#### Error Handling

**`sanitizeError()`** - Safe error extraction
```typescript
import { sanitizeError } from '@betthink/shared';

try {
  // ... some operation
} catch (error) {
  const safeError = sanitizeError(error);
  logger.error(safeError.message);
}
```

#### Odds Conversion

**`convertOdds()`** - Simplified odds conversion
```typescript
import { convertOdds } from '@betthink/shared';

const decimal = convertOdds(-110, 'american', 'decimal'); // 1.909
const american = convertOdds(2.5, 'decimal', 'american'); // +150
```

#### Deep Links

**`buildDeepLinkUrl()`** - Custom deep links with query params
```typescript
import { buildDeepLinkUrl } from '@betthink/shared';

const url = buildDeepLinkUrl(
  'https://betthink.app',
  '/bet/123',
  { source: 'notification', type: 'bet_result' }
);
// https://betthink.app/bet/123?source=notification&type=bet_result
```

## 🔧 Integration in Your Code

### Already Updated

✅ **Centralized Type Exports** - `src/common/types/shared-types.ts`
  - Added all v0.2.0 types (ChatMessage, SSE events, notifications, etc.)

✅ **Centralized Utility Exports** - `src/common/utils/shared-utils.ts`
  - Added all v0.2.0 utilities (formatRelativeTime, truncate, etc.)

✅ **Build System** - No compilation errors

✅ **Examples File** - Updated to use proper type annotations

### Where to Use New Features

#### 1. Chat Controller (SSE Streaming)

Consider updating `src/modules/chat/chat.controller.ts` to use SSE types:

```typescript
import { ChatSSEEvent } from '@betthink/shared';

@Sse('stream')
streamChat(): Observable<MessageEvent<ChatSSEEvent>> {
  // Type-safe SSE streaming
}
```

#### 2. Analytics Tracking

Add analytics event tracking throughout the app:

```typescript
import { AnalyticsEvent } from '@betthink/shared';

async logEvent(userId: string, eventName: EventName, eventData: any) {
  const event: AnalyticsEvent = {
    userId,
    eventName,
    eventData,
    timestamp: new Date().toISOString(),
    // ...
  };
  await this.prisma.analyticsEvent.create({ data: event });
}
```

#### 3. Push Notifications

Add push notification service:

```typescript
import { PushNotification, DeviceToken } from '@betthink/shared';

@Injectable()
export class PushNotificationService {
  async sendNotification(notification: PushNotification) {
    // Send to Expo push service
  }
  
  async registerDevice(device: DeviceToken) {
    // Register device token
  }
}
```

#### 4. UI Utilities

Use new utility functions in responses:

```typescript
import { formatRelativeTime, truncate } from '@betthink/shared';

async getConversations(userId: string) {
  const conversations = await this.prisma.conversation.findMany({
    where: { userId },
  });
  
  return conversations.map(conv => ({
    ...conv,
    timeAgo: formatRelativeTime(conv.updatedAt),
    preview: truncate(conv.lastMessage?.content || '', 100),
  }));
}
```

## 📊 Testing

All existing code continues to work. Run your tests:

```bash
pnpm test
```

Build succeeds with no errors:

```bash
pnpm build
```

## 🚀 Next Steps

1. **Implement SSE Streaming** - Add Server-Sent Events for real-time chat
2. **Add Analytics** - Track user events for insights
3. **Implement Push Notifications** - Send bet results and reminders
4. **Use Utility Functions** - Leverage new helpers for better UX
5. **Mobile Sync** - Implement offline-first chat with `LocalChatMessage`

## 📝 Breaking Changes

**None!** All changes are additive and backwards compatible.

## 🐛 Issues Fixed

- ✅ Fixed TypeScript compilation errors in examples file
- ✅ Added missing `OddsUtils` import in odds service
- ✅ Updated centralized exports with v0.2.0 types and utilities

## 📚 Resources

- **CHANGELOG**: `/node_modules/@betthink/shared/CHANGELOG.md`
- **Types Documentation**: Check type definitions in `node_modules/@betthink/shared/dist/types/`
- **Utilities Documentation**: Check utility definitions in `node_modules/@betthink/shared/dist/utils/`

---

✅ **Migration Status: COMPLETE**

Your API is now running on `@betthink/shared` v0.2.0 with all new features available for use!

