export interface LoginData {
	email: string;
	password: string;
}

export interface ParentRegisterData {
	phone_number: string;
	email: string;
	password: string;
	name: string;
	gender: string;
}

export interface StudentRegisterData {
	age: number;
	email: string;
	password: string;
	name: string;
	gender: string;
}

export interface TeacherRegisterData {
	phone_number: string;
	years_of_experience: number;
	email: string;
	zoom_email: string;
	password: string;
	name: string;
	gender: string;
}

export interface LoginResponse {
	id: number;
	email: string;
	name: string;
	gender: string;
	profile: Array<{ bio: string; picture: string }> | null;
	role: string;
	url: string;
}

export interface User {
	id: number;
	email: string;
	name: string;
	gender: string;
	role: string;
	url: string;
	profile: UserProfile;
	zoom_email: string | null;
}

export interface UserProfile {
	bio: string;
	picture: string | File;
	profile_image: string;
}

export type TeacherTimeslot = {
	id: number;
	day_of_week: number;
	start_time: string;
	end_time: string;
	is_free: boolean;
	student?: number;
};

export type TimeRange = {
	start_time: string;
	end_time: string;
};

export type DaySchedule = {
	[key: number]: TimeRange[];
};

export type Session = {
	id: number;
	teacher: number;
	teacher_name: string;
	students: number[];
	students_names: string[];
	date: string;
	start_time: string;
	end_time: string;
	status: string;
	created_at: string;
	zoom_meeting_id: string;
	zoom_meeting_link: string;
};

export type SubscriptionPlan = {
	id: number;
	name: string;
	price: string;
	sessions_count: number;
	is_group: boolean;
	duration_days: number;
	session_duration: number;
};

export type CheckoutResponse = {
	sessionId: string;
	error?: string;
};

export interface AuthContextType {
	user: User | null;
	login: (userData: User) => void;
	logout: () => void;
}

export type TeacherDashboardData = {
	upcoming_sessions: {
		count: number;
		next_session_timestamp: number | null;
	};
	pending_reports: TeacherDashboardSessionReport[];
};

export type Teacher = {
	id: number;
	phone_number: string;
	hire_date: string | null;
	years_of_experience: number;
	user: User;
};

export type Parent = {
	id: number;
	phone_number: string;
	user: User;
};

export type Student = {
	id: number;
	age: number;
	assigned_parent: Parent | null;
	assigned_teacher: Teacher;
	enrolled_at: string;
	completed_sessions_count: number;
	user: User;
};

type ResourceType = 'document' | 'video' | 'file';

type ResourceStudent = {
	id: number;
	name: string;
	email: string;
	enrolled_at: string;
};

export type Resource = {
	id: number;
	file: string;
	category: string;
	title: string;
	description: string;
	resource_type: ResourceType;
	students_assigned: ResourceStudent[];
	video_url: string;
	created_at: string;
};

export type ResourceAssign = {
	resource_id: number;
	student_ids: number[];
};

export interface StudentProfile extends User {
	role: 'S';
	age: number;
	enrolled_at: string;
	assigned_parent: number | null;
	assigned_teacher: number | null;
}

export interface TeacherProfile extends User {
	role: 'T';
	phone_number: string;
	hire_date: string | null;
	zoom_email: string;
	years_of_experience: number;
}

export type Profile = StudentProfile | TeacherProfile;

export type ContentItem = {
	key: string;
	value: string;
};

export type SessionReportData = {
	content: ContentItem[];
	rate: number;
	student: number;
	session_slot: number;
};

export type TeacherDashboardSessionReport = {
	due_date: string;
	session_id: number;
	student: string;
	student_id: number;
};

export type TimeSlot = {
	id: number;
	day_of_week: number;
	start_time: string;
	end_time: string;
	is_free: boolean;
	student: number | null;
};

export type OccupyTimeslotData = {
	teacher_id: number;
	student_id: number;
	day_of_week: number;
	start_time: string;
	end_time: string;
};
