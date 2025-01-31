import {
  LoginResponse,
  LoginData,
  User,
  ParentRegisterData,
  StudentRegisterData,
  TeacherTimeslot,
  TeacherRegisterData,
} from '@/types'
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api/',
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<User>('/users/me/')
    return data as User
  } catch {
    return null
  }
}

export async function registerTeacher(
  registerData: TeacherRegisterData,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(
    '/authentication/register/teachers/',
    registerData,
  )
  return data
}

export async function registerStudent(
  registerData: StudentRegisterData,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(
    '/authentication/register/students/',
    registerData,
  )
  return data
}

export async function registerParent(
  registerData: ParentRegisterData,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(
    '/authentication/register/parents/',
    registerData,
  )
  return data
}

export async function loginUser(loginData: LoginData): Promise<User> {
  const { data } = await api.post<User>('/authentication/login/', loginData)
  return data
}

export async function logoutUser(): Promise<null> {
  const { data } = await api.post<null>('/authentication/logout/')
  return data
}

export function timeslotsBulkCreate(slots: TeacherTimeslot[]) {
  return api.post('/time-slots/bulk_create/', slots)
}

export async function getTimeSlots(
  teacherId: number,
): Promise<TeacherTimeslot[]> {
  const { data } = await api.get(`/time-slots/${teacherId}/teacher_slots/`)
  return data
}

export async function getUserSessions() {
  const { data } = await api.get('/time-slots/user_sessions/')
  return data
}

export default api
