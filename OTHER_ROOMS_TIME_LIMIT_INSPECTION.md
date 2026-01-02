# Inspection: Time Limit Configuration for OTHER Group Rooms

## Current Configuration Structure

### 1. Room Configuration (capacity_configurations)
For OTHER group rooms, when configured via the admin interface:
- Uses a special `capacity_id: 'other'` with `capacity_label: 'N/A'`
- Stores cleaning types and their time limits in the configuration
- Example structure:
```json
[{
  "capacity_id": "other",
  "capacity_label": "N/A",
  "cleaning_types": [
    { "type": "S", "time_limit": 15 },
    { "type": "G", "time_limit": 90 }
  ],
  "capacity": 0
}]
```

### 2. Task Creation (Guest Count Selection)
When creating a task for an OTHER room:
- The UI shows numeric guest count options: "1", "2", "3", etc. (up to 10)
- User selects a numeric value (e.g., "1")
- This becomes the `capacityId` for the task

### 3. Time Limit Lookup Logic
The `getTimeLimitFromRoom` function:
1. Parses the room's `capacity_configurations`
2. Tries to find a config where `config.capacity_id === capacityId`
3. If found, returns the time_limit for the cleaning type
4. If NOT found, returns `null` and falls back to the `limits` table

## THE PROBLEM

**Mismatch between stored configuration and task creation:**
- Room config has: `capacity_id: 'other'`
- Task creation uses: `capacityId: '1'` (or '2', '3', etc.)
- **They don't match!**
- Result: `getTimeLimitFromRoom` returns `null`
- Falls back to `limits` table which has incorrect values (G=20, T=30 instead of 90)

## Expected Behavior

For OTHER rooms, the time limit should be retrieved from the room's capacity_configurations regardless of which numeric guest count is selected, since OTHER rooms use a single configuration with `capacity_id: 'other'`.

## Solution

Modified `getTimeLimitFromRoom` to handle the special case for OTHER rooms:
- When room group is 'OTHER' and capacity_configurations exist
- Look for the config with `capacity_id: 'other'` (the special placeholder used for OTHER rooms)
- If not found, fall back to the first config (OTHER rooms typically have only one config)
- This way, any numeric capacityId selected during task creation will correctly retrieve the time limit from the room's configuration

## Files Fixed
1. `src/components/reception/AddTaskDialog.tsx`
2. `src/hooks/useReceptionActions.ts`
3. `src/components/reception/TaskDetailDialog.tsx`

All three locations now handle OTHER rooms correctly by looking for `capacity_id: 'other'` instead of trying to match the numeric capacityId.

