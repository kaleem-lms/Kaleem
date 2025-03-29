import React, { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { parentRegisterSchema } from '@/schemas/parentRegisterSchema'
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
import { registerParent } from '@/api/axios'

const ParentRegisterForm: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const form = useForm<z.infer<typeof parentRegisterSchema>>({
    resolver: zodResolver(parentRegisterSchema),
  })

  const [errors, setErrors] = useState<{ [key: string]: string[] }>({})

  const handleSubmit = async (values: z.infer<typeof parentRegisterSchema>) => {
    try {
      await registerParent(values)
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
        <div className="flex gap-2">
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

export default ParentRegisterForm
