import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { registerTeacher } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { teacherRegisterSchema } from '@/schemas/teacherRegisterSchema';

interface TeacherRegisterFormProps {
	nextStep: () => void;
}

const TeacherRegisterForm: React.FC<TeacherRegisterFormProps> = ({ nextStep }) => {
	const { t } = useTranslation();

	const form = useForm<z.infer<typeof teacherRegisterSchema>>({
		resolver: zodResolver(teacherRegisterSchema),
	});

	const [errors, setErrors] = useState<{ [key: string]: string[] }>({});

	async function handleSubmit(values: z.infer<typeof teacherRegisterSchema>) {
		const updatedValues = {
			...values,
			years_of_experience: Number(values.years_of_experience),
		};
		try {
			await registerTeacher(updatedValues);
			nextStep();
		} catch (error) {
			if (error instanceof AxiosError && error.response) {
				setErrors(error.response.data);
			} else {
				console.log(error);
			}
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
				<div className="flex gap-2">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Name')}</FormLabel>
								<FormControl>
									<Input placeholder="Kaleem" type="text" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="gender"
						render={({ field }) => (
							<FormItem className="flex-1">
								<FormLabel>{t('Gender')}</FormLabel>
								<FormControl>
									<Select onValueChange={(value) => field.onChange(value)} defaultValue={field.value}>
										<SelectTrigger>
											<SelectValue placeholder={t('Gender')} />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="M">{t('Male')}</SelectItem>
											<SelectItem value="F">{t('Female')}</SelectItem>
										</SelectContent>
									</Select>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('Email')}</FormLabel>
							<FormControl>
								<Input placeholder="kaleem@kaleem.com" type="email" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="zoom_email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('Zoom Email')}</FormLabel>
							<FormControl>
								<Input placeholder="kaleem@kaleem.com" type="email" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('Password')}</FormLabel>
							<FormControl>
								<Input {...field} type="password" placeholder="••••••••" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="phone_number"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('Phone Number')}</FormLabel>
							<FormControl>
								<Input placeholder="+41123456789" type="tel" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="years_of_experience"
					render={({ field }) => (
						<FormItem className="flex-1">
							<FormLabel>{t('Years of Experience')}</FormLabel>
							<FormControl>
								<Input
									placeholder="1"
									type="number"
									min="1"
									max="120"
									value={field.value}
									onChange={(e) => {
										const value = e.target.value;
										field.onChange(value ? Number(value) : 0);
									}}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				{Object.keys(errors)?.map((error) =>
					errors[error].map((error, index) => (
						<p
							key={index}
							className={cn('mb-2 h-0 overflow-hidden font-medium text-red-500 text-sm transition-all', error && 'h-auto')}
						>
							{error}
						</p>
					)),
				)}
				<Button type="submit">{t('Create Account')}</Button>
			</form>
		</Form>
	);
};

export default TeacherRegisterForm;
