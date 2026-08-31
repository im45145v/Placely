"use client";

import { useEffect, useEffectEvent } from "react";
import type { RealtimeResponseEvent } from "appwrite";
import { getBrowserClient } from "@/lib/appwrite/client";

interface UseRealtimeSubscriptionOptions<TPayload> {
  enabled?: boolean;
  channels: string[];
  onEvent: (event: RealtimeResponseEvent<TPayload>) => void;
}

export function useRealtimeSubscription<TPayload>({
  enabled = true,
  channels,
  onEvent,
}: UseRealtimeSubscriptionOptions<TPayload>): void {
  const handleEvent = useEffectEvent(onEvent);

  useEffect(() => {
    if (!enabled || channels.length === 0) {
      return;
    }

    const unsubscribe = getBrowserClient().subscribe<TPayload>(channels, (event) => {
      handleEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, [channels, enabled]);
}
