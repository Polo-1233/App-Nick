/**
 * mock-calendar-data.ts — Realistic mock calendar events (7-day window)
 *
 * Usage:
 *   import { getMockCalendarEvents } from './mock-calendar-data';
 *   const events = getMockCalendarEvents();
 *
 * Switch logic (in use-day-plan / calendar-unified):
 *   const events = realEvents.length > 0 ? realEvents : getMockCalendarEvents();
 *
 * Times are in MinuteOfDay (0 = midnight, 540 = 09:00, etc.)
 */

import type { CalendarEvent } from '@r90/types';

function dateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function hm(h: number, m = 0): number {
  return h * 60 + m;
}

let _id = 1;
function mkId(): string { return `mock-evt-${_id++}`; }

/**
 * Returns ~25 realistic calendar events spread across 7 days
 * (3 days past + today + 3 days future).
 *
 * Represents a plausible professional week with social life.
 */
export function getMockCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [

    // ── 3 days ago ───────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(-3),
      title:        'Team standup',
      start:        hm(9),
      end:          hm(9, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(-3),
      title:        'Lunch — client',
      start:        hm(12, 30),
      end:          hm(14),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(-3),
      title:        'Gym session',
      start:        hm(18),
      end:          hm(19, 15),
      calendarName: 'Personal',
      color:        '#3DDC97',
    },

    // ── 2 days ago ───────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(-2),
      title:        'Morning run',
      start:        hm(6, 30),
      end:          hm(7, 15),
      calendarName: 'Personal',
      color:        '#3DDC97',
    },
    {
      id:           mkId(),
      date:         dateOffset(-2),
      title:        'Product review',
      start:        hm(10),
      end:          hm(11, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(-2),
      title:        'Dinner with friends',
      start:        hm(19, 30),
      end:          hm(22, 30),
      calendarName: 'Personal',
      color:        '#F5A623',
    },

    // ── Yesterday ─────────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(-1),
      title:        'Early call — New York',
      start:        hm(7),
      end:          hm(8),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(-1),
      title:        'Strategy session',
      start:        hm(11),
      end:          hm(12, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(-1),
      title:        'Physiotherapy',
      start:        hm(17),
      end:          hm(18),
      calendarName: 'Personal',
      color:        '#3DDC97',
    },
    {
      id:           mkId(),
      date:         dateOffset(-1),
      title:        'Late drinks — colleague',
      start:        hm(21),
      end:          hm(23),
      calendarName: 'Personal',
      color:        '#F5A623',
    },

    // ── Today ─────────────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(0),
      title:        'Team standup',
      start:        hm(9),
      end:          hm(9, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(0),
      title:        'Client call',
      start:        hm(11),
      end:          hm(12),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(0),
      title:        'Gym session',
      start:        hm(13),
      end:          hm(14, 15),
      calendarName: 'Personal',
      color:        '#3DDC97',
    },
    {
      id:           mkId(),
      date:         dateOffset(0),
      title:        'Review & planning',
      start:        hm(15),
      end:          hm(16, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },

    // ── Tomorrow ──────────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(1),
      title:        'Early morning meeting',
      start:        hm(7, 30),
      end:          hm(8, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(1),
      title:        'Flight — London Heathrow',
      start:        hm(12),
      end:          hm(14, 30),
      calendarName: 'Travel',
      color:        '#9B59B6',
    },
    {
      id:           mkId(),
      date:         dateOffset(1),
      title:        'Hotel check-in',
      start:        hm(15, 30),
      end:          hm(16),
      calendarName: 'Travel',
      color:        '#9B59B6',
    },

    // ── In 2 days ─────────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(2),
      title:        'Keynote presentation',
      start:        hm(9),
      end:          hm(11),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(2),
      title:        'Working lunch',
      start:        hm(12),
      end:          hm(13, 30),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(2),
      title:        'Networking dinner',
      start:        hm(19),
      end:          hm(22),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },

    // ── In 3 days ─────────────────────────────────────────────────────────────
    {
      id:           mkId(),
      date:         dateOffset(3),
      title:        'Return flight',
      start:        hm(8),
      end:          hm(10, 30),
      calendarName: 'Travel',
      color:        '#9B59B6',
    },
    {
      id:           mkId(),
      date:         dateOffset(3),
      title:        'Remote catch-up',
      start:        hm(14),
      end:          hm(15),
      calendarName: 'Work',
      color:        '#4DA3FF',
    },
    {
      id:           mkId(),
      date:         dateOffset(3),
      title:        'Gym — recovery session',
      start:        hm(17, 30),
      end:          hm(18, 30),
      calendarName: 'Personal',
      color:        '#3DDC97',
    },
  ];

  return events;
}
