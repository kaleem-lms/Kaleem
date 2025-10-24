import { useState, useEffect } from 'react';
import { getAdminTeacher } from '@/api/axios';
import { Teacher, TimeSlot } from '@/types';
import BookingModal from './BookingModal';
import TeacherCard from './TeacherCard';

export default function TeachersPage() {
	const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
	const [teachers, setTeachers] = useState<Teacher[]>([]);
	const [isBookingOpen, setIsBookingOpen] = useState(false);

	useEffect(() => {
		getAdminTeacher().then((data) => {
			setTeachers(data);
		});
	}, []);

	const handleBookSlot = (teacher: Teacher, slot: TimeSlot) => {
		setSelectedTeacher(teacher);
		setSelectedSlot(slot);
		setIsBookingOpen(true);
	};

	const handleBookingComplete = () => {
		setIsBookingOpen(false);
		setSelectedTeacher(null);
		setSelectedSlot(null);

		getAdminTeacher().then((data) => {
			setTeachers(data);
		});
	};

	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground mb-2">Available Teachers</h1>
					<p className="text-muted-foreground">Browse our qualified Quran teachers and book your preferred time slots</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{teachers.map((teacher) => (
						<TeacherCard key={teacher.id} teacher={teacher} onBookSlot={handleBookSlot} />
					))}
				</div>

				{teachers.length === 0 && (
					<div className="text-center py-12">
						<p className="text-muted-foreground text-lg">No teachers available at the moment</p>
					</div>
				)}
			</div>

			{selectedTeacher && selectedSlot && (
				<BookingModal
					isOpen={isBookingOpen}
					onClose={() => setIsBookingOpen(false)}
					teacher={selectedTeacher}
					timeSlot={selectedSlot}
					onBookingComplete={handleBookingComplete}
				/>
			)}
		</main>
	);
}
