import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DaySchedule, TeacherTimeslot, TimeRange } from '@/types'
import { timeslotsBulkCreate } from '@/api/axios'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export default function WeeklySchedule() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const daysOfWeek = {
    0: t('Saturday'),
    1: t('Sunday'),
    2: t('Monday'),
    3: t('Tuesday'),
    4: t('Wednesday'),
    5: t('Thursday'),
    6: t('Friday'),
  }
  const [schedule, setSchedule] = useState<DaySchedule>(
    Object.keys(daysOfWeek).reduce((acc, day) => ({ ...acc, [day]: [] }), {}),
  )


  const addTimeRange = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: [...prev[day], { start_time: '09:00', end_time: '17:00' }],
    }))
  }

  const updateTimeRange = (
    day: number,
    index: number,
    field: keyof TimeRange,
    value: string,
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].map((range, i) =>
        i === index ? { ...range, [field]: value } : range,
      ),
    }))
  }

  const removeTimeRange = (day: number, index: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }))
  }

  const exportSchedule = () => {
    const exportData: TeacherTimeslot[] = Object.entries(schedule).flatMap(
      ([day, ranges]) =>
        ranges.map((range) => ({
          day_of_week: parseInt(day),
          start_time: range.start_time,
          end_time: range.end_time,
          is_free: true,
        })),
    )

    timeslotsBulkCreate(exportData)
      .then(() => {
        navigate({ to: '/' })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const TimeRangeSelector = ({
    day,
    range,
    index,
  }: {
    day: number
    range: TimeRange
    index: number
  }) => (
    <div className="flex items-center space-x-2 mb-2">
      <Select
        value={range.start_time}
        onValueChange={(value) =>
          updateTimeRange(day, index, 'start_time', value)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Start Time" />
        </SelectTrigger>
        <SelectContent>
          {[...Array(24)].map((_, hour) => (
            <SelectItem
              key={hour}
              value={`${hour.toString().padStart(2, '0')}:00`}
            >
              {`${hour.toString().padStart(2, '0')}:00`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={range.end_time}
        onValueChange={(value) =>
          updateTimeRange(day, index, 'end_time', value)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="End Time" />
        </SelectTrigger>
        <SelectContent>
          {[...Array(24)].map((_, hour) => (
            <SelectItem
              key={hour}
              value={`${hour.toString().padStart(2, '0')}:00`}
            >
              {`${hour.toString().padStart(2, '0')}:00`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="destructive" onClick={() => removeTimeRange(day, index)}>
        {t('Remove')}
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {Object.entries(daysOfWeek).map(([day, dayName]) => (
        <Card key={day}>
          <CardHeader>
            <CardTitle>{dayName}</CardTitle>
          </CardHeader>
          <CardContent>
            {schedule[parseInt(day)].map((range, index) => (
              <TimeRangeSelector
                key={index}
                day={parseInt(day)}
                range={range}
                index={index}
              />
            ))}
            <Button onClick={() => addTimeRange(parseInt(day))}>
              {t('Add Time Range')}
            </Button>
          </CardContent>
        </Card>
      ))}
      <Button className="w-full" onClick={exportSchedule}>
        Export Schedule
      </Button>
    </div>
  )
}
