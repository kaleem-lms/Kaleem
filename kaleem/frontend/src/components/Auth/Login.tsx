import { Link, useNavigate } from '@tanstack/react-router';
import { AxiosError } from 'axios';
import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { loginUser } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '../AuthContext';
import Header from '../Landing/Header';

const Login: React.FC = () => {
	const { t } = useTranslation();
	const { login } = useAuth();
	const navigate = useNavigate();

	const form = useForm({
		defaultValues: {
			email: '',
			password: '',
		},
	});

	const [errors, setErrors] = useState<{ [key: string]: string[] }>({});

	async function handleSubmit(values: { email: string; password: string }) {
		try {
			const user = await loginUser(values);
			login(user);
			navigate({ to: '/' });
		} catch (error) {
			if (error instanceof AxiosError && error.response) {
				setErrors(error.response.data);
			} else {
				console.log(error);
			}
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			<Header />
			<div className="flex flex-1 items-center justify-center bg-background">
				<Card className="mx-auto max-w-sm">
					<CardHeader>
						<CardTitle className="text-2xl">{t('Login')}</CardTitle>
						<CardDescription>{t('Enter your email below to login to your account.')}</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
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
								{Object.keys(errors)?.map((error) =>
									errors[error].map((error) => (
										<p
											key={error}
											className={cn('mb-2 h-0 overflow-hidden font-medium text-red-500 text-sm transition-all', error && 'h-auto')}
										>
											{error}
										</p>
									)),
								)}
								<Button type="submit">{t('Login')}</Button>
								<p className="mt-4 text-center">
									{t('Need an account?')}
									<Link to="/register" className="ml-1 font-medium text-primary">
										{t('Register here')}
									</Link>
								</p>
							</form>
						</Form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default Login;
