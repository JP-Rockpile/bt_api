# @betthink/shared Package Integration Guide

This document demonstrates how the `@betthink/shared` package is integrated across the BetThink API.

## Overview

The `@betthink/shared` package provides:
- **Shared Types**: Common interfaces, enums, and type definitions
- **Shared Utilities**: Odds conversion, calculations, team mapping, deep linking
- **Shared Schemas**: Zod validation schemas for data validation
- **Error Classes**: Standardized error handling

## Installation

The package is installed via pnpm with GitHub registry authentication:

```bash
pnpm add @betthink/shared@npm:@jp-rockpile/shared@^0.1.0
```

### NPM Configuration

Create `.npmrc` (already gitignored):
```
@jp-rockpile:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

## Centralized Imports

We've created central re-export files for convenience:

### Types
`src/common/types/shared-types.ts` - Re-exports all shared types:
```typescript
import { Bet, Market, Odds, User, Sportsbook } from '@betthink/shared';
// Or use the centralized import:
import { Bet, Market, Odds } from '../../common/types/shared-types';
```

### Utilities
`src/common/utils/shared-utils.ts` - Re-exports all shared utilities:
```typescript
import { americanToDecimal, calculateEV } from '@betthink/shared';
// Or use the centralized import:
import { americanToDecimal, calculateExpectedValue } from '../../common/utils/shared-utils';
```

## Integration Examples

### 1. Bets Module

#### DTOs Enhanced with Shared Types

`src/modules/bets/dto/confirm-bet.dto.ts`:
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ConfirmBetDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  eventId: string;

  @ApiProperty({ description: 'Stake amount in dollars' })
  @IsNumber()
  stake: number;

  @ApiProperty({ description: 'American odds at confirmation' })
  @IsNumber()
  oddsAmerican: number;

  @ApiPropertyOptional({ description: 'User notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

#### Service Using Shared Utilities

`src/modules/bets/bets.service.ts`:
```typescript
import { 
  americanToDecimal,
  calculateExpectedValue,
  calculatePayout,
  type Odds 
} from '@betthink/shared';

@Injectable()
export class BetsService {
  async confirmBet(userId: string, dto: ConfirmBetDto) {
    // Use shared utility for conversion
    const oddsDecimal = americanToDecimal(dto.oddsAmerican);

    // Calculate payout using shared utility
    const odds: Odds = {
      american: dto.oddsAmerican,
      decimal: oddsDecimal,
      fractional: '', 
      impliedProbability: 0,
    };
    const { profit, totalPayout } = calculatePayout(odds, dto.stake);

    // Create bet with calculated values
    const bet = await this.prisma.bet.create({
      data: {
        userId,
        stake: dto.stake,
        oddsAmerican: dto.oddsAmerican,
        oddsDecimal,
        // ... other fields
      },
    });

    this.logger.log(
      `Bet confirmed: ${bet.id} - $${bet.stake} at ${bet.oddsAmerican} odds. ` +
      `Potential profit: $${profit.toFixed(2)}`
    );

    return bet;
  }

  async calculateBetEV(betId: string, trueProbability: number) {
    const bet = await this.prisma.bet.findUnique({ where: { id: betId } });
    
    const odds: Odds = {
      american: bet.oddsAmerican,
      decimal: Number(bet.oddsDecimal),
      fractional: '',
      impliedProbability: 0,
    };

    return calculateExpectedValue(odds, trueProbability, Number(bet.stake));
  }
}
```

### 2. Deep Link Service

`src/modules/bets/services/deep-link.service.ts`:
```typescript
import { 
  buildDeepLink, 
  supportsDeepLinking,
  type MarketType 
} from '@betthink/shared';

@Injectable()
export class DeepLinkService {
  generateDeepLink(bet: BetWithRelations): string | null {
    const sportsbookId = bet.sportsbook.providerKey.toLowerCase();

    // Check if deep linking is supported
    if (supportsDeepLinking(sportsbookId)) {
      const result = buildDeepLink(sportsbookId, {
        eventId: bet.event.externalIds?.[sportsbookId],
        marketType: bet.market.marketType as MarketType,
        selection: bet.selectedOutcome,
        odds: bet.americanOdds,
        stake: bet.stake,
      });
      
      if (result) {
        this.logger.log(`Generated ${result.scheme} deep link: ${result.url}`);
        return result.url;
      }
    }

    return null;
  }
}
```

### 3. Chat Module with Shared Types

`src/modules/chat/dto/index.ts`:
```typescript
import { MessageRole, MessageIntent } from '@betthink/shared';

export class CreateMessageDto {
  @ApiProperty({ enum: MessageRole })
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: MessageIntent })
  @IsOptional()
  @IsEnum(MessageIntent)
  intent?: MessageIntent;
}
```

### 4. Odds Calculations

`src/modules/odds/odds.service.ts`:
```typescript
import {
  calculateVigPercentage,
  isLowVigMarket,
  type Odds,
  type BestOdds,
} from '@betthink/shared';

@Injectable()
export class OddsService {
  async getEventOdds(eventId: string) {
    // ... fetch odds data

    // Use shared utilities for calculations
    const allOdds = outcomes.map(o => ({ 
      american: o.odds,
      decimal: americanToDecimal(o.odds),
      fractional: '',
      impliedProbability: 0,
    }));

    const vigPercentage = calculateVigPercentage(allOdds);
    const isLowVig = isLowVigMarket(allOdds, 1.0); // 1% threshold

    return {
      marketId: market.id,
      vigPercentage,
      isLowVig,
      outcomes,
    };
  }
}
```

### 5. Team/League Canonicalization

`src/modules/odds/services/canonical-mapping.service.ts`:
```typescript
import {
  canonicalizeTeamName,
  fuzzyMatchTeam,
  normalizeString,
} from '@betthink/shared';

@Injectable()
export class CanonicalMappingService {
  resolveTeamName(providerTeamName: string): string | null {
    // Try exact canonical match first
    const canonical = canonicalizeTeamName(providerTeamName);
    if (canonical) return canonical;

    // Fall back to fuzzy matching
    const fuzzyMatch = fuzzyMatchTeam(providerTeamName, 0.85);
    if (fuzzyMatch) {
      this.logger.log(
        `Fuzzy matched "${providerTeamName}" to "${fuzzyMatch.canonicalId}" ` +
        `with confidence ${fuzzyMatch.confidence}`
      );
      return fuzzyMatch.canonicalId;
    }

    this.logger.warn(`Failed to resolve team name: ${providerTeamName}`);
    return null;
  }
}
```

### 6. Error Handling

```typescript
import {
  AppError,
  ValidationError,
  NotFoundError,
  isAppError,
  formatErrorResponse,
} from '@betthink/shared';

try {
  // ... some operation
  throw new NotFoundError('Bet', betId);
} catch (error) {
  if (isAppError(error)) {
    return formatErrorResponse(error);
  }
  throw error;
}
```

### 7. User Risk Settings

`src/modules/users/dto/index.ts`:
```typescript
export class UpdateRiskSettingsDto {
  @ApiPropertyOptional({ description: 'Total bankroll' })
  @IsOptional()
  @IsNumber()
  bankroll?: number;

  @ApiPropertyOptional({ description: 'Max bet as % of bankroll' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxBetPercentage?: number;

  @ApiPropertyOptional({ description: 'Kelly Criterion fraction' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  kellyFraction?: number;
}
```

Then in your service:
```typescript
import { calculateKellyCriterion } from '@betthink/shared';

// Calculate optimal stake using Kelly Criterion
const kellyResult = calculateKellyCriterion(
  odds,
  userEstimatedProbability,
  user.bankroll,
  user.riskSettings.kellyFraction || 0.25
);

return {
  recommendedStake: kellyResult.recommendedStake,
  kellyPercentage: kellyResult.kellyPercentage,
  warning: kellyResult.warning,
};
```

## Available Utilities

### Odds Conversion
- `americanToDecimal`, `decimalToAmerican`
- `americanToFractional`, `fractionalToAmerican`
- `americanToImpliedProbability`, `impliedProbabilityToAmerican`
- All combinations of conversions

### Vig Calculations
- `calculateVigPercentage` / `calculateHoldPercentage`
- `calculateOverround`
- `removeVigProportional`, `removeVigPower`, `removeVigAdditive`
- `getFairOdds`, `getFairProbability`
- `isLowVigMarket`
- `calculateEffectiveVig`

### Betting Calculations
- `calculateExpectedValue` (EV)
- `calculateClosingLineValue` (CLV)
- `calculatePayout`
- `calculateParlayOdds`, `calculateParlayProbability`
- `detectArbitrage`
- `calculateHedge`
- `calculateBreakevenWinRate`
- `calculateROI`

### Stake Sizing
- `calculateKellyCriterion`
- `calculateFixedPercentageStake`
- `calculateUnitStake`
- `validateStake`
- `calculateRecommendedUnitSize`

### Team/League Mapping
- `canonicalizeTeamName`, `canonicalizeLeagueName`
- `fuzzyMatchTeam`, `fuzzyMatchLeague`
- `normalizeString`
- `calculateSimilarity`, `levenshteinDistance`
- `registerTeamMapping`, `registerLeagueMapping`

### Deep Linking
- `buildDeepLink(sportsbookId, params)`
- `supportsDeepLinking(sportsbookId)`
- `getSupportedSportsbooks()`
- Supported: DraftKings, FanDuel, BetMGM, Caesars, PointsBet

## Benefits

1. **Consistency**: Same calculations across frontend and backend
2. **Type Safety**: Shared types ensure API contracts match client expectations
3. **Reduced Duplication**: Write once, use everywhere
4. **Easier Maintenance**: Update logic in one place
5. **Better Testing**: Test utilities once in shared package
6. **Frontend Integration**: React Native app can import same types/utils

## Best Practices

1. **Use centralized imports** when possible:
   ```typescript
   import { Odds, calculateEV } from '../../common/types/shared-types';
   ```

2. **Convert Prisma types** when needed:
   ```typescript
   const decimalOdds = Number(bet.oddsDecimal); // Prisma Decimal -> number
   ```

3. **Document shared type usage** in DTOs:
   ```typescript
   /**
    * Maps to shared BetConfirmation type
    */
   export class ConfirmBetDto { ... }
   ```

4. **Re-export for convenience**:
   ```typescript
   // In your utils file
   export { calculateEV } from '@betthink/shared';
   
   // Add API-specific helpers
   export function customHelper() { ... }
   ```

5. **Use type imports** for types-only:
   ```typescript
   import type { Odds, Market } from '@betthink/shared';
   ```

## Next Steps

- Consider using Zod schemas from shared package for validation
- Explore SDK client for making API calls (frontend integration)
- Add more team/league mappings as needed
- Contribute back to shared package when you find missing utilities

## Troubleshooting

### Package not found
Ensure `.npmrc` is configured with correct GitHub token with `read:packages` scope.

### Type mismatches
Check that Prisma types are converted to primitives before passing to shared utilities.

### Module resolution
Ensure TypeScript paths are configured correctly in `tsconfig.json`.

