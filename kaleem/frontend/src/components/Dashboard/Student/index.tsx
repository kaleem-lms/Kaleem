import { OverviewStats } from '@/components/Dashboard/Student/OverviewStats';
import { RatingsChart } from '@/components/Dashboard/Student/RatingsChart';
import { TimeMetrics } from '@/components/Dashboard/Student/TimeMetrics';
import { TeachersList } from '@/components/Dashboard/Student/TeachersList';
import { StudentHeader } from '@/components/Dashboard/Student/StudentHeader';
import { useEffect, useState } from 'react';
import { getStudentDashboard } from '@/api/axios';


export default function StudentDashboard() {
	const [studentData, setStudentData] = useState()

	useEffect(() => {
		getStudentDashboard().then((data) => {
			setStudentData(data)
		})
	}, [])

	if (!studentData) {
		return <div>Loading...</div>
	}

	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<StudentHeader student={studentData.metadata} />

				{/* Overview Stats Grid */}
				<div className="mt-8">
					<OverviewStats overview={studentData.overview} />
				</div>

				{/* Main Content Grid */}
				<div className="mt-8 grid gap-6 lg:grid-cols-3">
					{/* Left Column - Time Metrics */}
					<div className="lg:col-span-1">
						<TimeMetrics overview={studentData.overview} />
					</div>

					{/* Right Column - Ratings and Teachers */}
					<div className="lg:col-span-2 space-y-6">
						<RatingsChart ratings={studentData.ratings} />
						<TeachersList teachers={studentData.teachers} />
					</div>
				</div>
			</div>
		</main>
	);
}
