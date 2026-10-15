import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class SafeThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(context: Parameters<ThrottlerGuard['handleRequest']>[0]): Promise<boolean> {
    try {
      return await super.handleRequest(context);
    } catch (error) {
      if (error instanceof Error && error.name === 'ThrottlerException') throw error;
      throw new ServiceUnavailableException('Request protection temporarily unavailable');
    }
  }
}
