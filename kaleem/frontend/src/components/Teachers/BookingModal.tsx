import type React from 'react';
import { useEffect, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Student, Teacher, TimeSlot } from '@/types';
import { formatTime, getDayName, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { getAdminStudents, occupyTeacherTime } from '@/api/axios';
import { useToast } from '@/hooks/use-toast';

interface BookingModalProps {
	isOpen: boolean;
	onClose: () => void;
	teacher: Teacher;
	timeSlot: TimeSlot;
	onBookingComplete: () => void;
}

export default function BookingModal({ isOpen, onClose, teacher, timeSlot, onBookingComplete }: BookingModalProps) {
	const [students, setStudents] = useState<Student[]>([]);
	const { toast } = useToast();
	const [selectedStudent, setSelectedStudent] = useState<number>();
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		student: '',
		startTime: timeSlot.start_time,
		endTime: timeSlot.end_time,
		duration: 60,
	});

	const initials = teacher.user.name
		.split(' ')
		.map((n) => n[0])
		.join('');

	const slotStartMinutes = timeStringToMinutes(timeSlot.start_time);
	const slotEndMinutes = timeStringToMinutes(timeSlot.end_time);
	const maxDurationMinutes = slotEndMinutes - slotStartMinutes;

	const durationOptions = [15, 30, 45, 60, 90, 120].filter((d) => d <= maxDurationMinutes);

	useEffect(() => {
		if (isOpen) {
			getAdminStudents().then((data) => {
				setStudents(data);
			});
		}
	}, [isOpen]);

	const handleDurationChange = (newDuration: number) => {
		const startMinutes = timeStringToMinutes(formData.startTime);
		const endMinutes = startMinutes + newDuration;
		const newEndTime = minutesToTimeString(endMinutes);

		setFormData((prev) => ({
			...prev,
			duration: newDuration,
			endTime: newEndTime,
		}));
	};

	const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newStartTime = e.target.value;
		const startMinutes = timeStringToMinutes(newStartTime);
		const endMinutes = startMinutes + formData.duration;
		const newEndTime = minutesToTimeString(endMinutes);

		// Ensure end time doesn't exceed slot end time
		const slotEnd = timeStringToMinutes(timeSlot.end_time);
		const finalEndTime = endMinutes > slotEnd ? timeSlot.end_time : newEndTime;

		setFormData((prev) => ({
			...prev,
			startTime: newStartTime,
			endTime: finalEndTime,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!selectedStudent) {
			toast({
				title: 'Error',
				description: 'Please select a student',
				variant: 'destructive',
			});
			return;
		}

		setIsLoading(true);

		try {
			occupyTeacherTime({
				teacher_id: teacher.id,
				student_id: selectedStudent,
				day_of_week: timeSlot.day_of_week,
				start_time: formData.startTime,
				end_time: formData.endTime,
			})
				.then(() => {
					toast({
						title: 'Success',
						description: 'Booking submitted successfully',
					});
				})
				.catch(() => {
					toast({
						title: 'Error',
						description: 'Failed to submit booking',
						variant: 'destructive',
					});
				});

			onBookingComplete();
		} catch (error) {
			console.error('Booking failed:', error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Book a Session</DialogTitle>
					<DialogDescription>Complete your booking with {teacher.user.name}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Teacher Info */}
					<div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
						<Avatar className="h-10 w-10">
							<AvatarImage src={teacher.user.profile.profile_image || '/placeholder.svg'} alt={teacher.user.name} />
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
						<div className="flex-1">
							<p className="font-medium text-foreground">{teacher.user.name}</p>
							<p className="text-sm text-muted-foreground">{teacher.user.email}</p>
						</div>
					</div>

					{/* Available Time Slot Info */}
					<div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
						<p className="text-sm text-muted-foreground mb-1">Available Time Slot</p>
						<p className="font-semibold text-foreground">
							{getDayName(timeSlot.day_of_week)}, {formatTime(timeSlot.start_time)} - {formatTime(timeSlot.end_time)}
						</p>
						<p className="text-xs text-muted-foreground mt-1">Duration: {maxDurationMinutes} minutes available</p>
					</div>

					{/* Booking Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="duration">Session Duration</Label>
							<div className="flex flex-wrap gap-2">
								{durationOptions.map((option) => (
									<Button
										key={option}
										type="button"
										variant={formData.duration === option ? 'default' : 'outline'}
										size="sm"
										onClick={() => handleDurationChange(option)}
										className="flex-1 min-w-[80px]"
									>
										{option} min
									</Button>
								))}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="startTime">Start Time</Label>
								<Input
									id={'startTime'}
									name="startTime"
									type="time"
									value={formData.startTime.substring(0, 5)}
									onChange={handleStartTimeChange}
									min={timeSlot.start_time.substring(0, 5)}
									max={timeSlot.end_time.substring(0, 5)}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="endTime">End Time</Label>
								<Input
									id={'endTime'}
									name="endTime"
									type="time"
									value={formData.endTime.substring(0, 5)}
									disabled
									className="bg-muted cursor-not-allowed"
								/>
							</div>
						</div>

						{/* Students */}
						<div className="space-y-2">
							<Select onValueChange={setSelectedStudent}>
								<Label>Students</Label>
								<SelectTrigger>
									<SelectValue placeholder="Select a student" />
								</SelectTrigger>
								<SelectContent>
									{students.map((student) => (
										<SelectItem key={student.id} value={String(student.id)}>
											<div>
												<div className="font-medium">{student.user.name}</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<DialogFooter className="gap-2 sm:gap-0">
							<Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
								Cancel
							</Button>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? 'Booking...' : 'Confirm Booking'}
							</Button>
						</DialogFooter>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
