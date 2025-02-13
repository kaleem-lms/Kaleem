import React, { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { studentRegisterSchema } from '@/schemas/studentRegisterSchema'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNavigate } from '@tanstack/react-router'
import { registerStudent } from '@/api/axios'

const StudentRegisterForm: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const form = useForm<z.infer<typeof studentRegisterSchema>>({
    resolver: zodResolver(studentRegisterSchema),
  })

  const [errors, setErrors] = useState<{ [key: string]: string[] }>({})

  async function handleSubmit(values: z.infer<typeof studentRegisterSchema>) {
    const updatedValues = {
      ...values,
      age: Number(values.age),
    }
    try {
      await registerStudent(updatedValues)
      navigate({ to: '/login' })
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        setErrors(error.response.data)
      } else {
        console.log(error)
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Name')}</FormLabel>
              <FormControl>
                <Input placeholder={t("Kaleem")} type="text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{t('Age')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="18"
                    type="number"
                    min="1"
                    max="120"
                    value={field.value}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value ? Number(value) : 0)
                    }}
                  />
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
                  <Select
                    onValueChange={(value) => field.onChange(value)}
                    defaultValue={field.value}
                  >
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
          errors[error].map((error, index) => (
            <p
              key={index}
              className={cn(
                'text-sm text-red-500 h-0 mb-2 font-medium overflow-hidden transition-all',
                error && 'h-auto',
              )}
            >
              {error}
            </p>
          )),
        )}
        <Button type="submit">{t('Create Account')}</Button>
      </form>
    </Form>
  )
}

export default StudentRegisterForm
