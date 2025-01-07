import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const teacherRegisterSchema = z.object({
    name: z.string().min(1, { message: "Name can't be empty" }),
    phone_number: z.string()
        .regex(phoneRegex, { message: "Invalid phone number format." }),
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
    gender: z.enum(["M", "F"]),
});