"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface CountdownTimerProps {
  expiresAt: string;
  totalMs: number;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, totalMs, onExpire }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(
    () => Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!fired) { setFired(true); onExpire?.(); }
      return;
    }
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1000);
        if (next === 0 && !fired) { setFired(true); onExpire?.(); }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, fired, onExpire]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const percent = totalMs > 0 ? (remaining / totalMs) * 100 : 0;

  const urgency =
    remaining === 0
      ? "text-destructive"
      : remaining < 60_000
      ? "text-destructive"
      : remaining < 180_000
      ? "text-yellow-600"
      : "text-green-600";

  return (
    <div className="space-y-2">
      <div className={cn("text-4xl font-mono font-bold tabular-nums", urgency)}>
        {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
      </div>
      <Progress
        value={percent}
        className={cn(
          "h-2",
          remaining === 0
            ? "[&>div]:bg-destructive"
            : remaining < 60_000
            ? "[&>div]:bg-destructive"
            : remaining < 180_000
            ? "[&>div]:bg-yellow-500"
            : "[&>div]:bg-green-500"
        )}
      />
      <p className="text-xs text-muted-foreground">
        {remaining === 0 ? "Reservation expired" : "Hold expires in"}
      </p>
    </div>
  );
}
