import { BadRequestException, NotFoundException } from '@nestjs/common';

export function validateDictionaryApiRequest(language: string, query: Record<string, unknown>): void {
  if (Object.keys(query).length) throw new BadRequestException('Query parameters are not supported');
  // The historical English aliases are locale hints, not separate databases.
  if (!['en', 'en_us', 'en_gb'].includes(language.toLowerCase())) throw new NotFoundException();
}
