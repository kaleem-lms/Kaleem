import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type TimeRange = {
    start: string
    end: string
}

type DaySchedule = {
    ranges: TimeRange[]
}

type WeeklySchedule = {
    [key: string]: DaySchedule
}

const DAYS_OF_WEEK = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
]

const WeeklySchedule: React.FC = () => {
    const { control, handleSubmit } = useForm<WeeklySchedule>({
        defaultValues: DAYS_OF_WEEK.reduce((acc, day) => {
            acc[day] = { ranges: [{ start: '', end: '' }] }
            return acc
        }, {} as WeeklySchedule),
    })

    const { toast } = useToast()

    const mutation = useMutation({
        mutationFn: (data: WeeklySchedule) => {
            // Replace this with your actual API call
            return fetch('https://api.example.com/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then((res) => res.json())
        },
        onSuccess: () => {
            toast({
                title: 'Schedule Saved',
                description:
                    'Your weekly schedule has been saved successfully.',
            })
        },
        onError: () => {
            toast({
                title: 'Error',
                description:
                    'There was an error saving your schedule. Please try again.',
                variant: 'destructive',
            })
        },
    })

    const onSubmit = (data: WeeklySchedule) => {
        mutation.mutate(data)
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-8">
                {DAYS_OF_WEEK.map((day) => (
                    <Card key={day}>
                        <CardHeader>
                            <CardTitle>{day}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Controller
                                name={`${day}.ranges`}
                                control={control}
                                render={({ field }) => (
                                    <FieldArray {...field} day={day} />
                                )}
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Button type="submit" className="mt-6">
                Save Schedule
            </Button>
        </form>
    )
}

const FieldArray: React.FC<any> = ({ value, onChange, day }) => {
    const handleAddRange = () => {
        onChange([...value, { start: '', end: '' }])
    }

    const handleRemoveRange = (index: number) => {
        onChange(value.filter((_: any, i: number) => i !== index))
    }

    const handleChangeRange = (
        index: number,
        field: 'start' | 'end',
        newValue: string,
    ) => {
        const newRanges = [...value]
        newRanges[index][field] = newValue
        onChange(newRanges)
    }

    return (
        <div className="space-y-4">
            {value.map((range: TimeRange, index: number) => (
                <div key={index} className="flex items-center space-x-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor={`${day}-start-${index}`}>
                            Start Time
                        </Label>
                        <Input
                            type="time"
                            id={`${day}-start-${index}`}
                            value={range.start}
                            onChange={(e) =>
                                handleChangeRange(
                                    index,
                                    'start',
                                    e.target.value,
                                )
                            }
                        />
                    </div>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor={`${day}-end-${index}`}>End Time</Label>
                        <Input
                            type="time"
                            id={`${day}-end-${index}`}
                            value={range.end}
                            onChange={(e) =>
                                handleChangeRange(index, 'end', e.target.value)
                            }
                        />
                    </div>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleRemoveRange(index)}
                    >
                        Remove
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddRange}>
                Add Time Range
            </Button>
        </div>
    )
}

export default WeeklySchedule
