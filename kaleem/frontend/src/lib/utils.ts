import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
export function formatTimestamp(timestamp: number, options?: Intl.DateTimeFormatOptions) {
	return new Date(timestamp * 1000).toLocaleString('en-GB', {
		year: '2-digit',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
		...options,
	});
}
export function getDayName(dayOfWeek: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return days[dayOfWeek] || "Unknown"
}

export function formatTime(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const minute = Number.parseInt(minutes, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`
  } catch {
    return timeString
  }
}

export function getDayOfWeekNumber(date: Date): number {
  return date.getDay()
}

export function timeStringToMinutes(timeString: string): number {
  try {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const minute = Number.parseInt(minutes, 10)
    return hour * 60 + minute
  } catch {
    return 0
  }
}

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:00`
}
