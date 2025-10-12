import {
  IsOptional,
  IsObject,
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for updating user profile and preferences
 * Maps to shared UserProfile and UserPreferences types
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User preferences as JSON object (odds format, stake sizing, notifications, etc.)',
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Expo push notification device tokens',
    type: [String],
    example: ['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceTokens?: string[];

  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Smith',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    description: 'User profile picture URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

/**
 * DTO for linking a sportsbook account to user profile
 * Maps to shared LinkedSportsbookAccount type
 */
export class LinkSportsbookDto {
  @ApiProperty({
    description: 'Sportsbook ID to link',
    example: 'draftkings',
  })
  @IsString()
  @IsNotEmpty()
  sportsbookId: string;

  @ApiPropertyOptional({
    description: 'User preference order (lower = higher priority)',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  preferenceOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether user has verified account access',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Account username or email at sportsbook',
    example: 'john.smith@example.com',
  })
  @IsOptional()
  @IsString()
  accountIdentifier?: string;
}

/**
 * DTO for updating user risk settings
 * Maps to shared RiskSettings type
 */
export class UpdateRiskSettingsDto {
  @ApiPropertyOptional({
    description: 'Total bankroll amount',
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  bankroll?: number;

  @ApiPropertyOptional({
    description: 'Maximum bet size as percentage of bankroll',
    example: 5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  maxBetPercentage?: number;

  @ApiPropertyOptional({
    description: 'Maximum daily loss limit',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxDailyLoss?: number;

  @ApiPropertyOptional({
    description: 'Kelly Criterion fraction (typically 0.1-0.5)',
    example: 0.25,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  kellyFraction?: number;
}
