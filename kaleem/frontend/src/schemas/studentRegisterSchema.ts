import { z } from 'zod';

export const studentRegisterSchema = z.object({
	name: z.string().min(1, { message: "Name can't be empty" }),
	age: z
		.number()
		.min(1, { message: 'Age must be at least 1' })
		.max(120, { message: 'Age must be less than or equal to 120' }),
	email: z.string().email({ message: 'Invalid email address' }),
	password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
	gender: z.enum(['M', 'F']),
});
