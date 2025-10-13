import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('openai.apiKey') ?? '';
    this.chatModel = this.config.get<string>('openai.chatModel') ?? 'gpt-4o-mini';
    this.embeddingModel = this.config.get<string>('openai.embeddingModel') ?? 'text-embedding-3-small';
  }

  async *chatStream(messages: ChatMessage[], temperature: number = 0.2): AsyncGenerator<string> {
    // Lazy import to avoid hard dependency issues
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    const stream = await client.chat.completions.create({
      model: this.chatModel,
      messages,
      temperature,
      stream: true,
    });

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        yield delta;
      }
    }
  }

  async embed(text: string | string[]): Promise<number[] | number[][]> {
    const inputs = Array.isArray(text) ? text : [text];

    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    const res = await client.embeddings.create({
      model: this.embeddingModel,
      input: inputs,
    });

    const vectors = res.data.map((d) => d.embedding as number[]);
    return Array.isArray(text) ? vectors : vectors[0];
  }
}


