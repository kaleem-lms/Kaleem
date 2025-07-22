import axios from 'axios';
import type {
	CheckoutResponse,
	LoginData,
	LoginResponse,
	ParentRegisterData,
	Session,
	StudentRegisterData,
	SubscriptionPlan,
	TeacherDashboardData,
	TeacherRegisterData,
	TeacherTimeslot,
	User,
} from '@/types';

export const api = axios.create({
	baseURL: import.meta.env.MODE === 'development' ? 'http://localhost:8000/api/' : 'https://backend.kaleem.academy/api/',
	withCredentials: true,
	withXSRFToken: true,
	xsrfCookieName: 'csrftoken',
	xsrfHeaderName: 'X-CSRFToken',
});

export async function getCurrentUser(): Promise<User | null> {
	try {
		const { data } = await api.get<User>('/users/me/');
		return data as User;
	} catch {
		return null;
	}
}

export async function registerTeacher(registerData: TeacherRegisterData): Promise<LoginResponse> {
	const { data } = await api.post<LoginResponse>('/authentication/register/teachers/', registerData);
	return data;
}

export async function registerStudent(registerData: StudentRegisterData): Promise<LoginResponse> {
	const { data } = await api.post<LoginResponse>('/authentication/register/students/', registerData);
	return data;
}

export async function registerParent(registerData: ParentRegisterData): Promise<LoginResponse> {
	const { data } = await api.post<LoginResponse>('/authentication/register/parents/', registerData);
	return data;
}

export async function loginUser(loginData: LoginData): Promise<User> {
	const { data } = await api.post<User>('/authentication/login/', loginData);
	return data;
}

export async function logoutUser(): Promise<null> {
	const { data } = await api.post<null>('/authentication/logout/');
	return data;
}

export function timeslotsBulkCreate(slots: TeacherTimeslot[]) {
	return api.post('/time-slots/bulk_create/', slots);
}

export async function getTimeSlots(teacherId: number): Promise<TeacherTimeslot[]> {
	const { data } = await api.get(`/time-slots/${teacherId}/teacher_slots/`);
	return data;
}

export async function getUserSessions(): Promise<Session[]> {
	console.log('getUserSessions');
	const { data } = await api.get('/time-slots/user_sessions/');
	return data;
}

export async function getPlans(): Promise<SubscriptionPlan[]> {
	const { data } = await api.get('/subscriptions/plans/');
	return data;
}

export async function createCheckoutSession(planId: number | string): Promise<CheckoutResponse> {
	const { data } = await api.post('/checkout/create/', { plan_id: planId });
	return data;
}

export async function getTeacherDashboard(): Promise<TeacherDashboardData> {
	const { data } = await api.get('/teacher-dashboard/');
	return data;
}

export async function getTeacherStudents() {
	const { data } = await api.get('/teachers/students/');
	return data;
}

export async function getStudentReports(studentId: number) {
	const { data } = await api.get(`/reports/by-student/${studentId}/`);
	return data;
}

export default api;
