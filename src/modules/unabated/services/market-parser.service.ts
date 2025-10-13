import { Injectable } from '@nestjs/common';
import { ParsedMarkets } from '../interfaces/unabated.interfaces';

@Injectable()
export class MarketParserService {
  parseStraitMarket(lines: any[]): ParsedMarkets {
    const result: ParsedMarkets = {
      moneyline: [],
      spread: [],
      total: [],
    };

    for (const line of lines) {
      const outcome = (line.outcome || '').toLowerCase();
      const point = line.point;

      if (outcome === 'over' || outcome === 'under') {
        result.total.push(line);
      } else if (outcome === 'home' || outcome === 'away') {
        if (point != null && point !== 0) {
          result.spread.push(line);
        } else {
          result.moneyline.push(line);
        }
      }
    }

    return result;
  }

  groupLinesBySource(lines: any[]): Record<string, Record<string, any>> {
    const grouped: Record<string, Record<string, any>> = {};

    for (const line of lines) {
      const sourceId = line.sourceId;
      const outcome = line.outcome;

      if (!sourceId || !outcome) continue;

      if (!grouped[sourceId]) {
        grouped[sourceId] = {};
      }

      grouped[sourceId][outcome] = {
        price: line.price,
        decimalOdds: line.decimalOdds,
        point: line.point,
        updatedAt: line.updatedAt,
      };
    }

    return grouped;
  }
}
