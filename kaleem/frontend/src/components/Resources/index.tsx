import { useAuth } from '../AuthContext';
import StudentResourcesPage from './StudentResourcesPage';
import TeacherResourcesPage from './TeacherResourcesPage';

export default function Resources() {
  const { user } = useAuth();

  return (
    <>
      {user?.role === 'T' && <TeacherResourcesPage />}
      {user?.role === 'S' && <StudentResourcesPage/>}
      {user?.role === 'P' && <p>You are a parent.</p>}
    </>
  );
}
