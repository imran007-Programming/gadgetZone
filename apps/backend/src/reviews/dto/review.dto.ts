import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Original product, delivered in 2 days.' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  comment: string;
}

export class ModerateReviewDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiPropertyOptional({ example: 'Thanks for shopping with us!' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reply?: string;
}

export class QueryReviewsDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}
