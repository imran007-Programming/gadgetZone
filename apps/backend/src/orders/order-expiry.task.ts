import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service.js';

const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * Releases stock held by orders the shop never confirmed: once at startup, then
 * every 15 minutes, PENDING orders older than PENDING_ORDER_TTL_HOURS (default 48,
 * 0 turns it off) are cancelled. Safe with several API instances running, since each
 * order is only cancelled if it is still PENDING at that moment.
 */
@Injectable()
export class OrderExpiryTask implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryTask.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    const hours = Number(this.config.get('PENDING_ORDER_TTL_HOURS') ?? 48);
    if (!hours || this.config.get('NODE_ENV') === 'test') {
      this.logger.log('Auto-cancel of unconfirmed orders is off');
      return;
    }
    this.timer = setInterval(() => void this.run(hours), CHECK_EVERY_MS);
    this.timer.unref(); // never keeps the process alive on shutdown
    void this.run(hours);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async run(hours: number) {
    if (this.running) return; // a slow run is still going
    this.running = true;
    try {
      const cancelled = await this.orders.cancelStalePendingOrders(hours);
      if (cancelled > 0) {
        this.logger.log(`Cancelled ${cancelled} order(s) left unconfirmed for over ${hours}h; stock restored`);
      }
    } catch (err) {
      this.logger.error('Auto-cancel of unconfirmed orders failed', err instanceof Error ? err.stack : err);
    } finally {
      this.running = false;
    }
  }
}
