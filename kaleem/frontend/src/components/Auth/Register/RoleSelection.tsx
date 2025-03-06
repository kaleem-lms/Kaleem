import React from 'react'
import { Button } from '../../ui/button'
import { useTranslation } from 'react-i18next'

interface RoleSelectionProps {
  onSelect: (role: 'student' | 'teacher' | 'parent') => void
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4">
        <Button onClick={() => onSelect('student')} className="w-full">
          {t('I am a Student')}
        </Button>
        <Button onClick={() => onSelect('teacher')} className="w-full">
          {t('I am a Teacher')}
        </Button>
        <Button onClick={() => onSelect('parent')} className="w-full">
          {t('I am a Parent')}
        </Button>
      </div>
    </div>
  )
}

export default RoleSelection
