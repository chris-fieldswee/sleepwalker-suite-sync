# Sleepwalker Suite

Sleepwalker Suite coordinates hotel housekeeping work between reception, admins, and housekeeping staff.

## Language

**Location**:
A room or operational area where a housekeeping task can be assigned.
_Avoid_: Room when referring to non-guest-room areas such as laundry, storage, breakfast break, or breakfast service.

**Multiple Assignment Location**:
A location that may have more than one open housekeeping task on the same date.
_Avoid_: Special room, duplicate room exception

**Direct Assignment**:
A housekeeping task assignment to one specific active housekeeping staff member.
_Avoid_: Visibility by location, shared task list

**Completed Task**:
A housekeeping task whose work has been marked done.
_Avoid_: Hidden task

**Manager**:
An operational administrator who can manage day-to-day housekeeping work but cannot manage users or room configuration.
_Avoid_: Limited admin, mini-admin

## Relationships

- A **Location** can have at most one open housekeeping task per date unless it is a **Multiple Assignment Location**.
- The current **Multiple Assignment Locations** are Pralnia/Magazyn, Przerwa śniadaniowa, and Śniadania.
- A housekeeping user sees only tasks with a **Direct Assignment** to them.
- A **Completed Task** appears in all-task views, not in the default open-task view.
- A **Manager** has admin-panel access except for Users and Rooms.

## Example Dialogue

> **Dev:** "Can reception create another open task for Parter today?"
> **Domain expert:** "No. Only Pralnia/Magazyn, Przerwa śniadaniowa, and Śniadania can have multiple open tasks on one date."
>
> **Dev:** "Should Alina see open Parter tasks because she works housekeeping?"
> **Domain expert:** "No. She sees Parter only when that task is assigned directly to her."
>
> **Dev:** "Should Alina see a Gotowe task in her default list?"
> **Domain expert:** "No. Gotowe tasks belong in the all-task view."

## Flagged Ambiguities

- "Pokój" was used for both guest rooms and operational areas; resolved: use **Location** when the concept includes both.
- "Assigned" was used loosely; resolved: housekeeping visibility depends on **Direct Assignment** to the logged-in staff member.
