import { EventEmitter } from "node:events";
import type { FlightRunEvent } from "../shared/types.js";

export class RunEventHub {
  private readonly emitters = new Map<string, EventEmitter>();

  emit(runId: string, event: FlightRunEvent): void {
    const emitter = this.getEmitter(runId);
    emitter.emit("event", {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString()
    } satisfies FlightRunEvent);
  }

  subscribe(runId: string, listener: (event: FlightRunEvent) => void): () => void {
    const emitter = this.getEmitter(runId);
    emitter.on("event", listener);
    return () => emitter.off("event", listener);
  }

  private getEmitter(runId: string): EventEmitter {
    let emitter = this.emitters.get(runId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(100);
      this.emitters.set(runId, emitter);
    }
    return emitter;
  }
}
