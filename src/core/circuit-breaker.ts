import { childLogger } from './logger.js';

const log = childLogger('circuit-breaker');

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxCalls?: number;
}

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private halfOpenSuccesses = 0;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly halfOpenSuccessThreshold: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxCalls = opts.halfOpenMaxCalls ?? 2;
    this.halfOpenSuccessThreshold = 2;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        this.halfOpenSuccesses = 0;
        log.info({ breaker: this.name }, 'Circuit breaker HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new CircuitOpenError(this.name);
    }

    try {
      if (this.state === 'HALF_OPEN') this.halfOpenCalls++;
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses < this.halfOpenSuccessThreshold) {
        log.info({ breaker: this.name, successes: this.halfOpenSuccesses }, 'Circuit breaker HALF_OPEN — success, waiting for more');
        return;
      }
      log.info({ breaker: this.name }, 'Circuit breaker CLOSED (recovered)');
    }
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.halfOpenSuccesses = 0;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      log.error({ breaker: this.name, failures: this.failureCount }, 'Circuit breaker OPEN');
    }
  }

  getState(): State {
    return this.state;
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is OPEN`);
    this.name = 'CircuitOpenError';
  }
}
