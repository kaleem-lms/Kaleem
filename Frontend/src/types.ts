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

export interface AuthResponse {
    access: string;
    refresh: string;
}

export interface User{
    id: number;
    email: string;
    name: string;
    gender: string;
    role: string;
    url: string;
    profile: UserProfile;
}

export interface UserProfile{
    bio: string;
    picture: string;
}