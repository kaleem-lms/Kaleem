## 1. Authentication System
create role based authentication with roles student, teacher and parent
### requirements 
- use session based authentication
- register endpoint
- login endpoint
### notes
- use email for authentication

## **2. User & Profile Management**

- Implement models for User, Student, Teacher, Parent.
- Create endpoints for updating user profiles. (GET, POST, PUT)
- Ensure role-specific attributes (e.g., `Teacher.years_of_experience`, `Student.level`) you w'll find it in database desing.

---

## **3. Classroom & Student Management**

- Teachers can create, update, and delete classrooms.
- Students can join a class via invitation key.
- Parents can link to a student’s account after teacher approval.

**Requirements:**
- Implement CRUD endpoints for `Class`, `Student`, and `Parent`.
- Validate that only assigned teachers can modify classrooms.
- Generate unique invitation keys for class invitations.

---

### **4. Quizzes & Questions**

- Teachers can create quizzes with questions and answers.
- Students can attempt quizzes and receive XP points.
- Track student performance.

**Requirements:**

- Implement models for `Quiz`, `Question`, `Answer`, and `StudentAnswer`.
- Create API endpoints for quiz creation, attempts, and scoring.
- Ensure students cannot submit multiple answers to the same question.
- Ensure students cannot submit answer or quiz after time expired

---

### **5. Chat System**

- Implement messaging between users.
- Teachers can create groups and add students.
- Students/Parents can message teachers.

**Requirements:**

- Use Django Channels for real-time communication.
- Implement models for `Message`, `Group`, and `GroupMember`.
- Create WebSocket endpoints for real-time messages.

---

### **6. Subscription & Payment Integration**

- Implement subscription models for different plans.
- Integrate HyperPay/Paytabs for payments.
- Ensure role-based feature access based on subscription level.

**Requirements:**

- Secure API endpoints for handling payments.
- Store transaction logs.
- Send automated renewal notifications.
