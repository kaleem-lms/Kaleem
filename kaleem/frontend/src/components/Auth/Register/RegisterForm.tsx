import type React from 'react';
import ParentRegisterForm from '@/components/Auth/Register/ParentRegisterForm';
import StudentRegisterForm from '@/components/Auth/Register/StudentRegisterForm';
import TeacherRegisterForm from '@/components/Auth/Register/TeacherRegisterForm';

interface RegistrationFormProps {
	nextStep: () => void;
	role: 'student' | 'teacher' | 'parent' | null;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ nextStep, role }) => {
	return (
		<>
			{role === 'student' && <StudentRegisterForm />}
			{role === 'teacher' && <TeacherRegisterForm nextStep={nextStep} />}
			{role === 'parent' && <ParentRegisterForm />}
		</>
	);
};

export default RegistrationForm;
