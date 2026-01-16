"use client";

import { BrainIcon } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { Shimmer } from "./shimmer";

export type ThinkingIndicatorProps = {
  className?: string;
  message?: string;
};

const ThinkingIndicatorComponent = ({
  className,
  message = "Thinking...",
}: ThinkingIndicatorProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground text-sm py-2",
        className,
      )}
    >
      <BrainIcon className="size-4 animate-pulse" />
      <Shimmer duration={1.5}>{message}</Shimmer>
    </div>
  );
};

export const ThinkingIndicator = memo(ThinkingIndicatorComponent);
ThinkingIndicator.displayName = "ThinkingIndicator";
