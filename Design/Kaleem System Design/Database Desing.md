
# Authentication models
## User
- email
- password
- gender
- first_name
- last_name
- role: Enum("T", "P", "S")

## Student
- age
- assigned_parent =>`Parent` | null
- assigned_teacher => `Teacher` | null
- level: => `Level`
 
## Teacher
- phone_number
- hire_date
- years_of_experience: Int | null

## Parent
- phone_number
---
# Quizzes Models

## Quizzes
- sentence
- teacher: => `Teacher` | null
- class: => `Class` | null
- time in seconds: Int | null
- title
- image
- video | null

## Question
- content
- time: Int | null
- xp
- quiz: => `Quiz`

## Answer
- content
- question: => `Question`
- is_correct

## Student Answer
- answer: => `Answer`
- student: <=> `Student`
- time
 ---
# Classes Models

## Class
- title
- image
- teacher: => `Teacher`
- students: <=> `Student`

## Class invite
- teacher: <=> `Teacher`
- class: => `Class`
- student: => `Student`
- key
---
# Words Bank Models

## Student Word
- student: => `Student`
- word
# Leveling

## Level
- title
- value: int
- start_xp
- end_xp

---
# Chatting Models

## Message
- sender: => `User`
- receiver: => `Group`
- content

## Group
- title
- description
- author: => `User`

## Group Member
- group: => `Group`
- user: => `User`