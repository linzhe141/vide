import dayjs from 'dayjs'
import type { Tool } from '@/agent/core/types'

export const getNormalizeTime: Tool = {
  name: 'get_normalize_time',
  type: 'function',
  function: {
    name: 'get_normalize_time',
    description:
      'Get normalized time information using dayjs. Supports relative time calculations (e.g., "3 days ago", "next Monday", "2 hours later") and specific date queries. Returns formatted date/time and day of week.',
    parameters: {
      type: 'object',
      properties: {
        offset: {
          type: 'object',
          description: 'Relative time offset from current time',
          properties: {
            seconds: { type: 'number', description: 'Offset in seconds (e.g., -10 for 10s ago)' },
            minutes: { type: 'number', description: 'Offset in minutes (e.g., 5 for 5 min later)' },
            hours: { type: 'number', description: 'Offset in hours (e.g., -2 for 2 hours ago)' },
            days: { type: 'number', description: 'Offset in days (e.g., -7 for 7 days ago)' },
            weeks: { type: 'number', description: 'Offset in weeks (e.g., 1 for next week)' },
          },
        },
        weekday: {
          type: 'number',
          description: 'Target weekday: 0=Sunday, 1=Monday, ..., 6=Saturday. Use with direction.',
        },
        direction: {
          type: 'string',
          enum: ['next', 'last'],
          description: 'Direction for weekday search: "next" or "last"',
        },
        date: {
          type: 'string',
          description: 'Specific date to query (format: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss)',
        },
      },
    },
  },
  async executor(args: any = {}) {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const weekdaysCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

    let targetTime = dayjs()

    if (args.date) {
      targetTime = dayjs(args.date)
    } else if (args.offset) {
      const { seconds = 0, minutes = 0, hours = 0, days = 0, weeks = 0 } = args.offset
      targetTime = targetTime
        .add(seconds, 'second')
        .add(minutes, 'minute')
        .add(hours, 'hour')
        .add(days, 'day')
        .add(weeks, 'week')
    } else if (args.weekday !== undefined && args.direction) {
      const current = targetTime.day()
      const target = args.weekday
      let diff = target - current

      if (args.direction === 'next') {
        if (diff <= 0) diff += 7
      } else {
        if (diff >= 0) diff -= 7
      }
      targetTime = targetTime.add(diff, 'day')
    }

    const weekIndex = targetTime.day()
    return {
      date: targetTime.format('YYYY-MM-DD HH:mm:ss'),
      week: `${weekdaysCN[weekIndex]}（${weekdays[weekIndex]}）`,
    }
  },
}
