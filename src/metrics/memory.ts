/**
 * In-memory metrics sink.
 *
 * Simple implementation that collects metrics in memory.
 * Useful for testing and debugging.
 */

import type { MetricEvent, MetricsSink } from "./types.js";

/**
 * Create an in-memory metrics sink.
 *
 * @returns Sink that collects events in memory
 */
export function createInMemoryMetricsSink(): MetricsSink & {
  getEvents(): MetricEvent[];
  clear(): void;
} {
  const sink = new InMemoryMetricsSink();
  return {
    record: (event: MetricEvent) => sink.record(event),
    getEvents: () => sink.getEvents(),
    clear: () => sink.clear(),
  };
}

/**
 * Simple in-memory metrics sink implementation.
 */
class InMemoryMetricsSink implements MetricsSink {
  private events: MetricEvent[] = [];

  record(event: MetricEvent): void {
    // Store a copy to avoid mutations
    const copy: MetricEvent = {
      type: event.type,
      timestampMs: event.timestampMs,
    };
    if (event.attributes !== undefined) {
      copy.attributes = { ...event.attributes };
    }
    this.events.push(copy);
  }

  getEvents(): MetricEvent[] {
    // Return a copy of the events array
    return this.events.map((event) => {
      const copy: MetricEvent = {
        type: event.type,
        timestampMs: event.timestampMs,
      };
      if (event.attributes !== undefined) {
        copy.attributes = { ...event.attributes };
      }
      return copy;
    });
  }

  clear(): void {
    this.events.length = 0;
  }
}
