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

const getLabelGuestTotal = (label: string): number => {
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






