import { LoginData, User } from '@/types'
import axios from 'axios'

const api = axios.create({
    baseURL: 'http://localhost:8000/api/v1/',
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

// TODO: Fix me 
export async function (loginData: LoginData): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>(
        '/authentication/login/',
        loginData,
    )
    return data
}


export default api
