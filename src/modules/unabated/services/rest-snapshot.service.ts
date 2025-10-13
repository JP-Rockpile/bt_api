import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { SnapshotResponse, BetTypeRaw, MarketSourceRaw } from '../interfaces/unabated.interfaces';

@Injectable()
export class RestSnapshotService {
  private readonly logger = new Logger(RestSnapshotService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly rateLimitSeconds: number = 60;
  private lastRequestTime: Map<string, number> = new Map();

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('UNABATED_DATA_BASE_URL') || 'https://data.unabated.com';
    this.apiToken = this.configService.get<string>('UNABATED_API_TOKEN') || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 180000,
      headers: {
        'X-Api-Key': this.apiToken,
        Accept: 'application/json',
      },
    });
  }

  private async rateLimit(key: string): Promise<void> {
    const lastTime = this.lastRequestTime.get(key) || 0;
    const now = Date.now();
    const timeSinceLast = now - lastTime;

    if (timeSinceLast < this.rateLimitSeconds * 1000) {
      const sleepTime = this.rateLimitSeconds * 1000 - timeSinceLast;
      this.logger.debug(`Rate limiting: sleeping ${sleepTime}ms for ${key}`);
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }

    this.lastRequestTime.set(key, Date.now());
  }

  async fetchSnapshot(leagueId: string, marketType: string): Promise<SnapshotResponse> {
    const rateLimitKey = `${leagueId}:${marketType}`;
    await this.rateLimit(rateLimitKey);

    const endpoint = `/market/${leagueId.toLowerCase()}/${marketType}/odds`;
    this.logger.log(`Fetching snapshot: ${endpoint}`);

    try {
      const response = await this.client.get(endpoint);
      const data = response.data?.data?.odds?.[leagueId.toLowerCase()] || {};

      return {
        data,
        league_id: leagueId,
        market_type: marketType,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        success: response.data?.success || true,
        messages: response.data?.messages || [],
      };
    } catch (error) {
      this.logger.error(`Failed to fetch snapshot: ${error.message}`);
      throw error;
    }
  }

  async fetchBetTypes(): Promise<BetTypeRaw[]> {
    this.logger.log('Fetching bet types');

    try {
      const response = await this.client.get('/bettype');
      const betTypes = response.data?.data || response.data?.betTypes || response.data;

      if (!Array.isArray(betTypes)) {
        this.logger.warn('Unexpected bet types response format');
        return [];
      }

      this.logger.log(`Fetched ${betTypes.length} bet types`);
      return betTypes;
    } catch (error) {
      this.logger.error(`Failed to fetch bet types: ${error.message}`);
      throw error;
    }
  }

  async fetchMarketSources(league: string, marketType: string): Promise<MarketSourceRaw[]> {
    const endpoint = `/market/${league.toLowerCase()}/${marketType}/sources`;
    this.logger.log(`Fetching market sources: ${endpoint}`);

    try {
      const response = await this.client.get(endpoint);
      const sources = response.data?.data || response.data?.sources || response.data;

      if (!Array.isArray(sources)) {
        this.logger.warn('Unexpected sources response format');
        return [];
      }

      this.logger.log(`Fetched ${sources.length} market sources`);
      return sources;
    } catch (error) {
      this.logger.error(`Failed to fetch market sources: ${error.message}`);
      throw error;
    }
  }

  getAvailableLeagues(): string[] {
    // Default leagues - you can enhance this by fetching from API
    return ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'UFC', 'SOCCER', 'TENNIS'];
  }
}
