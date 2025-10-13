import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../llm/llm.service';
import { SseService } from './sse.service';
import { ChatService } from '../chat.service';
import { VectorSearchService } from '../../rag/services/vector-search.service';
import { OddsService } from '../../odds/odds.service';
import { EventsService } from '../../events/events.service';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly sse: SseService,
    private readonly chat: ChatService,
    private readonly rag: VectorSearchService,
    private readonly odds: OddsService,
    private readonly events: EventsService,
  ) {}

  async handleUserMessage(params: {
    userId: string;
    conversationId: string;
    content: string;
    timezone?: string;
  }) {
    const { userId, conversationId, content } = params;

    // Naive intent detection
    const lower = content.toLowerCase();
    const isOddsIntent = /(odds|moneyline|ml|spread|total|line)/.test(lower);

    if (isOddsIntent) {
      await this.answerOdds(userId, conversationId, content);
      return;
    }

    // RAG attempt: if results above threshold, include as context
    try {
      const embedding = (await this.llm.embed(content)) as number[];
      const results = await this.rag.search(embedding, 5, 0.8);
      if (results && results.length > 0) {
        const context = results
          .slice(0, 4)
          .map((r) => `- (${r.similarity.toFixed(2)}) ${r.content}`)
          .join('\n');

        const sys: ChatMessage = {
          role: 'system',
          content: `You are BetThink assistant. Use the following context snippets if relevant and cite briefly when used.\n${context}`,
        };
        await this.streamLlm(userId, conversationId, [sys, { role: 'user', content }]);
        return;
      }
    } catch (err: any) {
      this.logger.debug(`RAG skipped: ${err?.message ?? err}`);
    }

    // General LLM
    await this.streamLlm(userId, conversationId, [{ role: 'user', content }]);
  }

  private async streamLlm(
    userId: string,
    conversationId: string,
    messages: ChatMessage[],
  ) {
    let full = '';
    for await (const chunk of this.llm.chatStream(messages)) {
      full += chunk;
      this.sse.sendLLMChunk(userId, conversationId, chunk);
    }
    this.sse.sendLLMComplete(userId, conversationId, full);
    await this.chat.createMessage(userId, conversationId, 'ASSISTANT', full);
  }

  private async answerOdds(
    userId: string,
    conversationId: string,
    content: string,
  ) {
    // Extract a likely team token from the query (very naive first pass)
    const teamMatch = content.match(/\b([A-Za-z][A-Za-z\s]{2,})\b(?=.*(odds|moneyline|ml|tonight|today|game))/i);
    const teamRaw = teamMatch ? teamMatch[1].trim() : '';

    // Date window: today (UTC fallback)
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    // Find MLB events today matching team
    const events = await this.events.findAll({ sport: 'MLB', startDate: start, endDate: end });
    const candidate = events.find((e: any) => {
      if (!teamRaw) return false;
      const ht = (e.homeTeamCanonical || e.homeTeam || '').toLowerCase();
      const at = (e.awayTeamCanonical || e.awayTeam || '').toLowerCase();
      const needle = teamRaw.toLowerCase();
      return ht.includes(needle) || at.includes(needle);
    });

    if (!candidate) {
      await this.streamLlm(userId, conversationId, [
        {
          role: 'system',
          content:
            'If user asks for odds but no matching MLB event today, ask a clarifying question for team and date.',
        },
        { role: 'user', content },
      ]);
      return;
    }

    // Load markets and compute best moneyline
    const eventOdds = await this.odds.getEventOdds(candidate.id);
    const moneyline = eventOdds.markets.find((m: any) => m.marketType === 'MONEYLINE');

    if (!moneyline) {
      const msg = 'No moneyline market is available for this game yet.';
      this.sse.sendLLMComplete(userId, conversationId, msg);
      await this.chat.createMessage(userId, conversationId, 'ASSISTANT', msg);
      return;
    }

    // Summarize best prices
    const home = moneyline.bestOdds?.home
      ? { outcome: 'home', sportsbook: moneyline.bestOdds.home.sportsbook, oddsAmerican: moneyline.bestOdds.home.odds }
      : null;
    const away = moneyline.bestOdds?.away
      ? { outcome: 'away', sportsbook: moneyline.bestOdds.away.sportsbook, oddsAmerican: moneyline.bestOdds.away.odds }
      : null;

    const payload = {
      type: 'odds_best_moneyline',
      event: {
        id: eventOdds.event.id,
        homeTeam: eventOdds.event.homeTeam,
        awayTeam: eventOdds.event.awayTeam,
        startTime: eventOdds.event.startTime,
      },
      best: { home, away },
    };

    this.sse.sendToStream(userId, conversationId, payload);

    const text = `Best moneyline odds for ${eventOdds.event.awayTeam} @ ${eventOdds.event.homeTeam}:\n` +
      `${home ? `Home (${eventOdds.event.homeTeam}): ${home.oddsAmerican} at ${home.sportsbook}` : 'Home: N/A'}\n` +
      `${away ? `Away (${eventOdds.event.awayTeam}): ${away.oddsAmerican} at ${away.sportsbook}` : 'Away: N/A'}`;

    this.sse.sendLLMComplete(userId, conversationId, text, { payload });
    await this.chat.createMessage(userId, conversationId, 'ASSISTANT', text, { payload });
  }
}


