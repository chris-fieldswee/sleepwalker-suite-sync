import { z } from 'zod';

// Task input validation schemas
export const taskInputSchema = z.object({
  cleaning_type: z.enum(['W', 'P', 'T', 'O', 'G', 'S']),
  guest_count: z.number().int().min(1).max(20),
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
