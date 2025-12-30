import React from "react";
import { User } from "lucide-react";

export const CAPACITY_LABEL_ORDER = [
  "1",
  "1+1",
  "1+1+1",
  "2",
  "2+1",
  "2+2",
  "2+2+1",
  "2+2+2",
];

// Capacity identifier mapping: letter identifiers to labels
export const CAPACITY_ID_TO_LABEL: Record<string, string> = {
  'a': '1',
  'b': '1+1',
  'c': '1+1+1',
  'd': '2',
  'e': '2+1',
  'f': '2+2',
  'g': '2+2+1',
  'h': '2+2+2',
};

// Reverse mapping: labels to letter identifiers
export const LABEL_TO_CAPACITY_ID: Record<string, string> = {
  '1': 'a',
  '1+1': 'b',
  '1+1+1': 'c',
  '2': 'd',
  '2+1': 'e',
  '2+2': 'f',
  '2+2+1': 'g',
  '2+2+2': 'h',
};

export const normalizeCapacityLabel = (label: string): string => {
  if (!label) {
    return "";
  }

  const trimmed = label.trim();

  if (!trimmed.includes("+")) {
    return trimmed;
  }

  const normalized = trimmed
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("+");

  return normalized || trimmed;
};

export const getLabelGuestTotal = (label: string): number => {
  if (!label) {
    return 0;
  }

  return label
    .split("+")
    .map((part) => parseInt(part.trim(), 10))
    .filter((count) => !Number.isNaN(count) && count > 0)
    .reduce((total, count) => total + count, 0);
};

export const getCapacitySortKey = (label: string): number => {
  const normalized = normalizeCapacityLabel(label);
  const orderIndex = CAPACITY_LABEL_ORDER.indexOf(normalized);

  if (orderIndex !== -1) {
    return orderIndex;
  }

  const guestTotal = getLabelGuestTotal(normalized);

  // Offset unknown labels after the predefined order while maintaining a deterministic order.
  return CAPACITY_LABEL_ORDER.length + guestTotal * 10 + normalized.length;
};

/**
 * Renders icon patterns for capacity labels based on fixed visual arrangements.
 * Each pattern represents a unique icon arrangement, independent of numerical calculations.
 * This ensures that "1+1" and "2" display differently even though they represent the same total count.
 */
export const renderCapacityIconPattern = (label: string): React.ReactNode => {
  const normalized = normalizeCapacityLabel(label);
  
  // Define fixed icon arrangements for each unique pattern
  const patterns: Record<string, React.ReactNode> = {
    '1': (
      <div className="flex items-center gap-1">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
    '1+1': (
      <div className="flex items-center gap-1">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="mx-0.5 text-muted-foreground">+</span>
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
    '1+1+1': (
      <div className="flex items-center gap-1">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="mx-0.5 text-muted-foreground">+</span>
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="mx-0.5 text-muted-foreground">+</span>
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
    '2': (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    ),
    '2+1': (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="mx-0.5 text-muted-foreground">+</span>
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
    '2+2': (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="mx-0.5 text-muted-foreground">+</span>
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    ),
    '2+2+1': (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="mx-0.5 text-muted-foreground">+</span>
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="mx-0.5 text-muted-foreground">+</span>
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
    '2+2+2': (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="mx-0.5 text-muted-foreground">+</span>
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="mx-0.5 text-muted-foreground">+</span>
        <div className="flex items-center gap-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    ),
  };

  // Return the fixed pattern if it exists, otherwise fallback to calculated display
  if (patterns[normalized]) {
    return patterns[normalized];
  }

  // Fallback for labels not in the predefined patterns (e.g., numeric-only labels)
  const fallbackCount = parseInt(normalized, 10);
  if (!Number.isNaN(fallbackCount) && fallbackCount > 0) {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(fallbackCount, 5) }, (_, i) => (
          <User key={i} className="h-4 w-4 text-muted-foreground" />
        ))}
        {fallbackCount > 5 && (
          <span className="text-xs text-muted-foreground ml-0.5">+{fallbackCount - 5}</span>
        )}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="flex items-center gap-1">
      <User className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};

