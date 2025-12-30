import { z } from 'zod';

// Valid capacity_id values (a, b, c, d, e, f, g, h, and 'other' for OTHER rooms)
const capacityIdSchema = z.string().regex(/^([a-h]|other)$/, {
  message: "Capacity ID must be a valid letter identifier (a-h) or 'other'"
});

// Task input validation schemas
export const taskInputSchema = z.object({
  cleaning_type: z.enum(['W', 'P', 'T', 'O', 'G', 'S']),
  guest_count: capacityIdSchema, // Now stores capacity_id (a, b, c, d, etc.) instead of numeric value
  reception_notes: z.string().max(2000).optional().or(z.literal('')),
  housekeeping_notes: z.string().max(2000).optional().or(z.literal('')),
  issue_description: z.string().max(5000).optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room_id: z.string().uuid(),
});

// Work log validation schema
export const workLogSchema = z.object({
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_in: z.string().nullable(),
  time_out: z.string().nullable(),
  break_minutes: z.number().int().min(0).max(480),
  laundry_minutes: z.number().int().min(0).max(480),
  breakfast_minutes: z.number().int().min(0).max(480),
  total_minutes: z.number().int().min(0).max(960),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

// Partial schema for updates
export const taskUpdateSchema = taskInputSchema.partial();

// User creation validation schema
export const userCreationSchema = z.object({
  name: z.string().min(1, "Imię i nazwisko jest wymagane"),
  email: z.string().email("Nieprawidłowy format email"),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(['admin', 'reception', 'housekeeping']),
  active: z.boolean().default(true),
});
