/**
 * In-memory metrics sink.
 *
 * Simple implementation that collects metrics in memory.
 * Useful for testing and debugging.
 */

import type { MetricEvent, MetricsSink } from "./types";

/**
 * Create an in-memory metrics sink.
 *
 * @returns Sink that collects events in memory
 */
export function createInMemoryMetricsSink(): MetricsSink & { getEvents(): MetricEvent[] } {
  // TODO: return sink implementation that stores events in array with getter
  throw new Error("TODO");
}

/**
 * Simple in-memory metrics sink implementation.
 */
class InMemoryMetricsSink implements MetricsSink {
  private events: MetricEvent[] = [];

  record(event: MetricEvent): void {
    this.events.push(event);
  }

  getEvents(): MetricEvent[] {
    return this.events;
  }
}
