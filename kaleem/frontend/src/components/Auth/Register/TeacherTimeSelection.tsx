import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTimeSlots, timeslotsBulkCreate } from '@/api/axios';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TeacherTimeslot, TimeRange } from '@/types';

export default function WeeklySchedule() {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const { user } = useAuth();

	const daysOfWeek = {
		0: t('Saturday'),
		1: t('Sunday'),
		2: t('Monday'),
		3: t('Tuesday'),
		4: t('Wednesday'),
		5: t('Thursday'),
		6: t('Friday'),
	};

	const [schedule, setSchedule] = useState<Record<number, TimeRange[]>>(
		Object.keys(daysOfWeek).reduce((acc, day) => ({ ...acc, [day]: [] }), {}),
	);

	// Initial data schema
	const initialTimeSlots = [
		{
			id: 1,
			day_of_week: 0,
			start_time: '09:00:00',
			end_time: '17:00:00',
			is_free: true,
			student: null,
		},
		{
			id: 2,
			day_of_week: 1,
			start_time: '09:00:00',
			end_time: '17:00:00',
			is_free: true,
			student: null,
		},
		{
			id: 3,
			day_of_week: 1,
			start_time: '20:00:00',
			end_time: '23:00:00',
			is_free: true,
			student: null,
		},
		{
			id: 4,
			day_of_week: 3,
			start_time: '09:00:00',
			end_time: '17:00:00',
			is_free: true,
			student: null,
		},
		{
			id: 5,
			day_of_week: 5,
			start_time: '09:00:00',
			end_time: '17:00:00',
			is_free: true,
			student: null,
		},
	];

	// Fetch time slots on component mount
	useEffect(() => {
		const processTimeSlots = (slots: any[]) => {
			// Ensure slots is an array and handle potential undefined
			const validSlots = Array.isArray(slots) ? slots : initialTimeSlots;

			return validSlots.reduce((acc, slot) => {
				// Ensure slot has the expected properties
				if (!slot || typeof slot.day_of_week === 'undefined') return acc;

				const day = slot.day_of_week.toString();
				const timeRange = {
					start_time: (slot.start_time || '09:00:00').slice(0, 5), // Convert "HH:MM:SS" to "HH:MM"
					end_time: (slot.end_time || '17:00:00').slice(0, 5),
				};

				// Add the time range to the corresponding day
				return {
					...acc,
					[day]: [...(acc[day] || []), timeRange],
				};
			}, {});
		};

		getTimeSlots(user?.id)
			.then((response) => {
				// Handle different possible response structures
				const slots = response?.data || response || initialTimeSlots;

				const fetchedSchedule = processTimeSlots(slots);

				// If no time slots from API, use initial data
				setSchedule(Object.keys(fetchedSchedule).length > 0 ? fetchedSchedule : processTimeSlots(initialTimeSlots));
			})
			.catch((error) => {
				console.error('Error fetching time slots:', error);
				// Fallback to initial data if API call fails
				setSchedule(processTimeSlots(initialTimeSlots));
			});
	}, [user]);

	const addTimeRange = (day: number) => {
		setSchedule((prev) => ({
			...prev,
			[day]: [...prev[day], { start_time: '09:00', end_time: '17:00' }],
		}));
	};

	const updateTimeRange = (day: number, index: number, field: keyof TimeRange, value: string) => {
		setSchedule((prev) => ({
			...prev,
			[day]: prev[day].map((range, i) => (i === index ? { ...range, [field]: value } : range)),
		}));
	};

	const removeTimeRange = (day: number, index: number) => {
		setSchedule((prev) => ({
			...prev,
			[day]: prev[day].filter((_, i) => i !== index),
		}));
	};

	const exportSchedule = () => {
		const exportData: TeacherTimeslot[] = Object.entries(schedule).flatMap(([day, ranges]) =>
			ranges.map((range) => ({
				day_of_week: parseInt(day),
				start_time: range.start_time,
				end_time: range.end_time,
				is_free: true,
			})),
		);

		timeslotsBulkCreate(exportData)
			.then(() => {
				navigate({ to: '/' });
			})
			.catch((error) => {
				console.error(error);
			});
	};

	const TimeRangeSelector = ({ day, range, index }: { day: number; range: TimeRange; index: number }) => (
		<div className="mb-2 flex items-center space-x-2">
			<Select
				value={range.start_time}
				onValueChange={(value) => {
					updateTimeRange(day, index, 'start_time', value);
				}}
			>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Start Time" />
				</SelectTrigger>
				<SelectContent>
					{[...Array(24)].map((_, hour) => (
						<SelectItem key={`start-${hour}`} value={`${hour.toString().padStart(2, '0')}:00`}>
							{`${hour.toString().padStart(2, '0')}:00`}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				value={range.end_time}
				onValueChange={(value) => {
					updateTimeRange(day, index, 'end_time', value);
				}}
			>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="End Time" />
				</SelectTrigger>
				<SelectContent>
					{[...Array(24)].map((_, hour) => (
						<SelectItem key={`end-${hour}`} value={`${hour.toString().padStart(2, '0')}:00`}>
							{`${hour.toString().padStart(2, '0')}:00`}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Button variant="destructive" onClick={() => removeTimeRange(day, index)}>
				{t('Remove')}
			</Button>
		</div>
	);

	return (
		<Card className="mx-auto w-full max-w-4xl">
			<CardHeader>
				<CardTitle>{t('Weekly Schedule')}</CardTitle>
			</CardHeader>
			<CardContent>
				{Object.entries(daysOfWeek).map(([day, dayName]) => (
					<div key={day} className="mb-4">
						<h3 className="mb-2 font-semibold text-lg">{dayName}</h3>
						{schedule[parseInt(day)].map((range, index) => (
							<TimeRangeSelector key={index} day={parseInt(day)} range={range} index={index} />
						))}
						<Button variant="outline" onClick={() => addTimeRange(parseInt(day))}>
							{t('Add Time Range')}
						</Button>
					</div>
				))}
				<div className="mt-4">
					<Button onClick={exportSchedule}>{t('Export Schedule')}</Button>
				</div>
			</CardContent>
		</Card>
	);
}
