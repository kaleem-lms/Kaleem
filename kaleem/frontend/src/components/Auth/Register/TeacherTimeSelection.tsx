import { AlertTriangle, Clock, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTimeSlots, timeslotDelete, timeslotsBulkCreate } from '@/api/axios';
import { useAuth } from '@/components/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { TeacherTimeslot } from '@/types';

interface TimeRange {
	id: string;
	start_time: string;
	end_time: string;
	isExisting?: boolean; // Track if this is from API
	apiId?: number; // Original API ID for existing timeslots
	hasStudent?: boolean; // Track if timeslot has a student assigned
}

interface WeeklySchedule {
	[key: number]: TimeRange[];
}

const DAYS_OF_WEEK = [
	{ id: 0, name: 'Saturday', short: 'Sat' },
	{ id: 1, name: 'Sunday', short: 'Sun' },
	{ id: 2, name: 'Monday', short: 'Mon' },
	{ id: 3, name: 'Tuesday', short: 'Tue' },
	{ id: 4, name: 'Wednesday', short: 'Wed' },
	{ id: 5, name: 'Thursday', short: 'Thu' },
	{ id: 6, name: 'Friday', short: 'Fri' },
];

// Convert API timeslots to internal schedule format
const convertApiToSchedule = (timeslots: TeacherTimeslot[]): WeeklySchedule => {
	const schedule: WeeklySchedule = {};

	timeslots.forEach((slot) => {
		const dayId = slot.day_of_week;
		const timeRange: TimeRange = {
			id: `existing-${slot.id}`,
			start_time: slot.start_time.substring(0, 5), // Remove seconds
			end_time: slot.end_time.substring(0, 5),
			isExisting: true,
			apiId: slot.id,
			hasStudent: slot.student !== null,
		};

		if (!schedule[dayId]) {
			schedule[dayId] = [];
		}
		schedule[dayId].push(timeRange);
	});

	return schedule;
};

// Helper function to convert time string to minutes for comparison
const timeToMinutes = (time: string): number => {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
};

// Helper function to check if two time ranges overlap
const hasOverlap = (range1: TimeRange, range2: TimeRange): boolean => {
	const start1 = timeToMinutes(range1.start_time);
	const end1 = timeToMinutes(range1.end_time);
	const start2 = timeToMinutes(range2.start_time);
	const end2 = timeToMinutes(range2.end_time);

	return start1 < end2 && start2 < end1;
};

export default function TeacherScheduleSelector() {
	const [schedule, setSchedule] = useState<WeeklySchedule>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
	const { toast } = useToast();
	const { user } = useAuth();

	useEffect(() => {
		loadExistingSchedule();
	}, [loadExistingSchedule]);

	const loadExistingSchedule = async () => {
		setIsLoading(true);
		try {
			const existingTimeslots = await getTimeSlots(user?.id);
			const convertedSchedule = convertApiToSchedule(existingTimeslots);
			setSchedule(convertedSchedule);

			toast({
				title: 'Schedule Loaded',
				description: `Loaded ${existingTimeslots.length} existing time slots.`,
			});
		} catch (error) {
			console.error('Failed to load schedule:', error);
			toast({
				title: 'Load Error',
				description: 'Failed to load existing schedule. Please refresh the page.',
				variant: 'destructive',
			});
		} finally {
			setIsLoading(false);
		}
	};

	// Check if a new time range overlaps with existing ones for a day
	const checkForOverlaps = (dayId: number, newRange: TimeRange, excludeId?: string): boolean => {
		const dayRanges = schedule[dayId] || [];
		return dayRanges.some((range) => range.id !== excludeId && hasOverlap(range, newRange));
	};

	// Add a new time range to a specific day
	const addTimeRange = (dayId: number) => {
		const existingRanges = schedule[dayId] || [];

		// Convert ranges to minutes and sort them
		const sortedRanges = existingRanges
			.map((r) => ({
				...r,
				startMin: timeToMinutes(r.start_time),
				endMin: timeToMinutes(r.end_time),
			}))
			.sort((a, b) => a.startMin - b.startMin);

		const DAY_START = 8 * 60; // 08:00
		const DAY_END = 20 * 60; // 20:00
		const SLOT_LENGTH = 60; // 1 hour

		let availableStart = DAY_START;

		for (let i = 0; i <= sortedRanges.length; i++) {
			const nextRangeStart = i < sortedRanges.length ? sortedRanges[i].startMin : DAY_END;

			if (nextRangeStart - availableStart >= SLOT_LENGTH) {
				// Found a free slot
				const startHour = String(Math.floor(availableStart / 60)).padStart(2, '0');
				const startMin = String(availableStart % 60).padStart(2, '0');
				const endHour = String(Math.floor((availableStart + SLOT_LENGTH) / 60)).padStart(2, '0');
				const endMin = String((availableStart + SLOT_LENGTH) % 60).padStart(2, '0');

				const newRange: TimeRange = {
					id: `new-${dayId}-${Date.now()}`,
					start_time: `${startHour}:${startMin}`,
					end_time: `${endHour}:${endMin}`,
					isExisting: false,
				};

				setSchedule((prev) => ({
					...prev,
					[dayId]: [...(prev[dayId] || []), newRange],
				}));

				return;
			}

			// Move to next available minute after current range
			if (i < sortedRanges.length) {
				availableStart = Math.max(availableStart, sortedRanges[i].endMin);
			}
		}

		toast({
			title: 'No Free Slot Available',
			description: 'All available time ranges are full for this day.',
			variant: 'destructive',
		});
	};

	// Update a time range
	const updateTimeRange = (dayId: number, rangeId: string, field: 'start_time' | 'end_time', value: string) => {
		setSchedule((prev) => {
			const dayRanges = prev[dayId] || [];
			const updatedRanges = dayRanges.map((range) => {
				if (range.id === rangeId) {
					const updatedRange = { ...range, [field]: value };

					// Validate the time range
					if (timeToMinutes(updatedRange.start_time) >= timeToMinutes(updatedRange.end_time)) {
						toast({
							title: 'Invalid Time Range',
							description: 'Start time must be before end time.',
							variant: 'destructive',
						});
						return range; // Return original range if invalid
					}

					// Check for overlaps
					if (checkForOverlaps(dayId, updatedRange, rangeId)) {
						toast({
							title: 'Time Overlap',
							description: 'This time range overlaps with an existing one.',
							variant: 'destructive',
						});
						return range; // Return original range if overlap
					}

					return updatedRange;
				}
				return range;
			});

			return { ...prev, [dayId]: updatedRanges };
		});
	};

	// Delete a timeslot (either from API or just remove locally)
	const deleteTimeRange = async (dayId: number, rangeId: string) => {
		const range = schedule[dayId]?.find((r) => r.id === rangeId);

		if (!range) return;

		// Check if timeslot has a student assigned
		if (range.hasStudent) {
			toast({
				title: 'Cannot Delete',
				description: 'This time slot has a student assigned and cannot be deleted.',
				variant: 'destructive',
			});
			return;
		}

		// If it's an existing timeslot, delete from API
		if (range.isExisting && range.apiId) {
			setDeletingIds((prev) => new Set(prev).add(rangeId));

			try {
				await timeslotDelete(range.apiId);

				toast({
					title: 'Time Slot Deleted',
					description: 'The time slot has been successfully deleted.',
				});
			} catch (error) {
				console.error('Failed to delete timeslot:', error);
				toast({
					title: 'Delete Error',
					description: 'Failed to delete the time slot. Please try again.',
					variant: 'destructive',
				});
				setDeletingIds((prev) => {
					const newSet = new Set(prev);
					newSet.delete(rangeId);
					return newSet;
				});
				return;
			} finally {
				setDeletingIds((prev) => {
					const newSet = new Set(prev);
					newSet.delete(rangeId);
					return newSet;
				});
			}
		}

		// Remove from local state
		setSchedule((prev) => ({
			...prev,
			[dayId]: (prev[dayId] || []).filter((range) => range.id !== rangeId),
		}));
	};

	// Convert schedule to API format (only new timeslots)
	const convertToApiFormat = () => {
		const timeslots = [];

		for (const [dayId, ranges] of Object.entries(schedule)) {
			for (const range of ranges) {
				// Only include new timeslots (not existing ones)
				if (!range.isExisting) {
					timeslots.push({
						day_of_week: Number.parseInt(dayId, 10),
						start_time: range.start_time,
						end_time: range.end_time,
						is_free: true,
						student: null,
					});
				}
			}
		}

		return timeslots;
	};

	// Submit new timeslots to API
	const handleSubmit = async () => {
		const newTimeslots = convertToApiFormat();

		if (newTimeslots.length === 0) {
			toast({
				title: 'No New Time Slots',
				description: 'No new time slots to save. Add some time ranges first.',
				variant: 'destructive',
			});
			return;
		}

		setIsSubmitting(true);

		try {
			console.log('Submitting new timeslots:', JSON.stringify(newTimeslots, null, 2));

			await timeslotsBulkCreate(newTimeslots);

			toast({
				title: 'Schedule Saved',
				description: `Successfully created ${newTimeslots.length} new time slots.`,
			});

			// Reload the schedule to get the updated data with IDs
			await loadExistingSchedule();
		} catch (error) {
			console.error(error);
			toast({
				title: 'Error',
				description: 'Failed to save schedule. Please try again.',
				variant: 'destructive',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	// Get counts for different types of slots
	const getSlotCounts = () => {
		let existing = 0;
		let newSlots = 0;
		let withStudents = 0;

		Object.values(schedule).forEach((ranges) => {
			ranges.forEach((range) => {
				if (range.isExisting) {
					existing++;
					if (range.hasStudent) withStudents++;
				} else {
					newSlots++;
				}
			});
		});

		return { existing, newSlots, withStudents, total: existing + newSlots };
	};

	const slotCounts = getSlotCounts();

	if (isLoading) {
		return (
			<div className="max-w-6xl mx-auto p-6">
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="text-center space-y-4">
						<Loader2 className="w-8 h-8 animate-spin mx-auto" />
						<p className="text-muted-foreground">Loading your schedule...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Weekly Schedule</h1>
					<p className="text-muted-foreground">Manage your available time ranges for each day of the week</p>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex gap-2">
						<Badge variant="secondary" className="text-sm">
							<Clock className="w-4 h-4 mr-1" />
							{slotCounts.total} total
						</Badge>
						{slotCounts.existing > 0 && (
							<Badge variant="outline" className="text-sm">
								{slotCounts.existing} existing
							</Badge>
						)}
						{slotCounts.newSlots > 0 && (
							<Badge variant="default" className="text-sm">
								{slotCounts.newSlots} new
							</Badge>
						)}
						{slotCounts.withStudents > 0 && (
							<Badge variant="destructive" className="text-sm">
								<AlertTriangle className="w-3 h-3 mr-1" />
								{slotCounts.withStudents} booked
							</Badge>
						)}
					</div>
					<Button onClick={handleSubmit} disabled={isSubmitting || slotCounts.newSlots === 0} className="min-w-[120px]">
						{isSubmitting ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin mr-2" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Save New Slots
							</>
						)}
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{DAYS_OF_WEEK.map((day) => (
					<Card key={day.id} className="h-fit">
						<CardHeader className="pb-3">
							<CardTitle className="text-lg flex items-center justify-between">
								{day.name}
								<Button variant="outline" size="sm" onClick={() => addTimeRange(day.id)} className="h-8 w-8 p-0">
									<Plus className="w-4 h-4" />
								</Button>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{schedule[day.id]?.length === 0 || !schedule[day.id] ? (
								<p className="text-sm text-muted-foreground text-center py-4">No time ranges set</p>
							) : (
								schedule[day.id]?.map((range) => (
									<div
										key={range.id}
										className={`space-y-2 p-3 border rounded-lg ${
											range.hasStudent
												? 'bg-red-50 border-red-200'
												: range.isExisting
													? 'bg-blue-50 border-blue-200'
													: 'bg-green-50 border-green-200'
										}`}
									>
										<div className="flex items-center justify-between mb-2">
											<div className="flex gap-1">
												{range.isExisting && (
													<Badge variant="outline" className="text-xs">
														{range.hasStudent ? 'Booked' : 'Existing'}
													</Badge>
												)}
												{!range.isExisting && (
													<Badge variant="default" className="text-xs">
														New
													</Badge>
												)}
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => deleteTimeRange(day.id, range.id)}
												disabled={deletingIds.has(range.id) || range.hasStudent}
												className="h-6 w-6 p-0 text-destructive hover:text-destructive"
												title={range.hasStudent ? 'Cannot delete - student assigned' : 'Delete time slot'}
											>
												{deletingIds.has(range.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
											</Button>
										</div>
										<div className="grid grid-cols-2 gap-2">
											<div>
												<Label htmlFor={`start-${range.id}`} className="text-xs">
													Start
												</Label>
												<Input
													id={`start-${range.id}`}
													type="time"
													value={range.start_time}
													onChange={(e) => updateTimeRange(day.id, range.id, 'start_time', e.target.value)}
													className="h-8"
													disabled={range.isExisting}
												/>
											</div>
											<div>
												<Label htmlFor={`end-${range.id}`} className="text-xs">
													End
												</Label>
												<Input
													id={`end-${range.id}`}
													type="time"
													value={range.end_time}
													onChange={(e) => updateTimeRange(day.id, range.id, 'end_time', e.target.value)}
													className="h-8"
													disabled={range.isExisting}
												/>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												{range.start_time} - {range.end_time}
											</span>
											{range.hasStudent && <span className="text-xs text-red-600 font-medium">Student assigned</span>}
										</div>
									</div>
								))
							)}
						</CardContent>
					</Card>
				))}
			</div>

			{slotCounts.total > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Schedule Overview</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{DAYS_OF_WEEK.map((day) => {
								const dayRanges = schedule[day.id] || [];
								if (dayRanges.length === 0) return null;

								return (
									<div key={day.id} className="flex items-center gap-4">
										<div className="w-20 text-sm font-medium">{day.short}</div>
										<div className="flex flex-wrap gap-2">
											{dayRanges.map((range) => (
												<Badge
													key={range.id}
													variant={range.hasStudent ? 'destructive' : range.isExisting ? 'outline' : 'default'}
													className="text-xs"
												>
													{range.start_time} - {range.end_time}
													{range.hasStudent && ' (Booked)'}
												</Badge>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
