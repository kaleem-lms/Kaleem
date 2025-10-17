import { useAuth } from '../AuthContext';
import AdminDashboardPage from './Admin';
import ParentDashboardPage from './Parent';
import StudentDashboardPage from './Student';
import TeacherDashboardPage from './Teacher';

export default function Dashboard() {
	const { user } = useAuth();

	return (
		<>
			{user?.role === 'T' && <TeacherDashboardPage />}
			{user?.role === 'A' && <AdminDashboardPage />}
			{user?.role === 'S' && <StudentDashboardPage />}
			{user?.role === 'P' && <ParentDashboardPage />}
		</>
	);
}
