import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { loginSchema } from '@/schemas/loginSchema'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'

const Login: React.FC = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
    })

    const [errors, setErrors] = useState<{ [key: string]: string[] }>({})

    const { mutateAsync } = useMutation({
        mutationFn: loginUser,
        onSuccess: () => {
            navigate({ to: '/' })
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError && error.response) {
                setErrors(error.response.data)
            } else {
                console.log(error)
            }
        },
    })

    async function handleSubmit(values: z.infer<typeof loginSchema>) {
        await mutateAsync(values)
    }

    return (
        <Card className="mx-auto max-w-sm">
            <CardHeader>
                <CardTitle className="text-2xl">{t('Login')}</CardTitle>
                <CardDescription>
                    {t('Enter your email below to login to your account.')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="grid gap-4"
                    >
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('Email')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="kaleem@kaleem.com"
                                            type="email"
                                            {...field}
                                        />
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
                                    className={cn(
                                        'text-sm text-red-500 h-0 mb-2 font-medium overflow-hidden transition-all',
                                        error && 'h-auto',
                                    )}
                                >
                                    {error}
                                </p>
                            )),
                        )}
                        <Button type="submit">{t('Login')}</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

export default Login
