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
