# 🧭 Rimix – Detailed Technical Documentation

## 1. Introduction

**Rimix** is a smart and modern **task management and reminder assistant** built to automate daily organization through **voice recognition, file parsing, and intelligent reminders**.
It combines the simplicity of a to-do list app with the intelligence of natural interaction systems.

### 🎯 Objective

The main goal of Rimix is to **simplify how users manage tasks** using:

* Natural **voice input**
* **Automated extraction** of reminders from text files
* **Interactive alarms and notifications**
* Seamless **cloud-based storage** via MongoDB

The application is fully responsive, cross-platform, and customizable with dark/light themes.

---

## 2. System Architecture Overview

Rimix is designed using a **modular architecture** built on **Next.js 13 (App Router)** and **TypeScript** for strong typing.
The backend logic is integrated directly into the frontend framework through **Next.js API Routes**, allowing a unified full-stack structure.

### 2.1 Architectural Layers

| Layer           | Technology             | Description                                                 |
| --------------- | ---------------------- | ----------------------------------------------------------- |
| **UI Layer**    | Next.js + Tailwind CSS | Handles user interactions and rendering                     |
| **Logic Layer** | TypeScript + Web APIs  | Manages voice recognition, file processing, and alarm logic |
| **Data Layer**  | MongoDB + Mongoose     | Stores and retrieves reminders persistently                 |
| **API Layer**   | Next.js API Routes     | REST endpoints for CRUD operations on reminders             |

---

## 3. Functional Flow

### 3.1 User Journey

1. **Input Stage:**

   * User can create reminders using:

     * **Voice Command** (e.g., “Remind me to submit report tomorrow at 9 AM”)
     * **File Upload** (.txt or .docx containing tasks)
     * **Manual Entry** (title, description, category, date, etc.)

2. **Processing Stage:**

   * The system processes input through:

     * **Speech-to-Text conversion**
     * **Date and time extraction**
     * **Keyword-based categorization**
   * Data is converted into a structured format and stored in MongoDB.

3. **Notification Stage:**

   * When the reminder time is near:

     * The app triggers **desktop notifications** and **custom alarm sounds**
     * Users can **snooze**, **dismiss**, or **mark complete**

4. **Management Stage:**

   * Tasks can be filtered, edited, categorized, and prioritized.
   * Users can use the built-in **Timer** and **Stopwatch** for productivity tracking.

---

## 4. Detailed Module Explanation

### 4.1 Voice Recognition Module (`lib/speech.ts`)

#### Purpose

To enable natural, hands-free reminder creation using **speech input**.

#### Key Functionalities

* Uses **Web Speech API** for live transcription.
* Parses speech for date, time, and title.
* Detects natural language time expressions like:

  * “Tomorrow evening”
  * “In two hours”
  * “Next Friday at 5 PM”

#### Internal Logic

1. Initialize the `SpeechRecognition` object.
2. Capture user speech.
3. Convert speech to text and tokenize.
4. Use regex patterns and date parsers to detect time expressions.
5. Return a structured reminder object.

```ts
{
  title: "Submit project report",
  date: "2025-11-13",
  time: "09:00"
}
```

---

### 4.2 File Upload and Text Parsing (`lib/fileUpload.ts`)

#### Purpose

Automatically extract tasks or reminders from uploaded files.

#### Workflow

1. User uploads `.txt` file.
2. File content is read using `FileReader`.
3. The text is split line by line.
4. Each line is parsed for potential reminder fields.
5. Dates and priorities are identified using pattern recognition.

#### Example

Input file:

```
Submit assignment by Monday 9AM
Call doctor next Tuesday
Buy groceries tomorrow
```

Output (structured):

```json
[
  {"title": "Submit assignment", "date": "2025-11-17", "time": "09:00"},
  {"title": "Call doctor", "date": "2025-11-18"},
  {"title": "Buy groceries", "date": "2025-11-13"}
]
```

---

### 4.3 Alarm and Notification System (`lib/alarm.ts`)

#### Purpose

Trigger reminders with **sound, vibration, and desktop alerts**.

#### Components

* **Web Notifications API** for pop-ups
* **AudioContext** for playing custom alarm tones
* **Interactive dismiss/snooze options**

#### Functionality

1. Monitor reminder times continuously.
2. When current time matches a reminder’s schedule:

   * Display notification
   * Play alarm sound
   * Highlight the reminder card in UI

---

### 4.4 Database and Schema Management (`models/Reminder.ts`, `lib/mongoose.ts`)

#### Purpose

Provide a reliable and persistent data layer for reminders.

#### Schema

```ts
const ReminderSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  date: String,
  time: String,
  category: String,
  priority: String,
  completed: { type: Boolean, default: false },
});
```

#### MongoDB Connection

* Managed via a singleton connection file (`mongoose.ts`).
* Uses environment variable `NEXT_PUBLIC_MONGO_DB_URI`.

#### Example Connection Code:

```ts
mongoose.connect(process.env.NEXT_PUBLIC_MONGO_DB_URI!)
```

---

### 4.5 API Layer (`app/api/reminders/`)

#### Description

Implements RESTful API routes for reminders CRUD operations.

| Method     | Route                | Function                   |
| ---------- | -------------------- | -------------------------- |
| **GET**    | `/api/reminders`     | Fetch all reminders        |
| **POST**   | `/api/reminders`     | Create a new reminder      |
| **GET**    | `/api/reminders/:id` | Retrieve a single reminder |
| **PUT**    | `/api/reminders/:id` | Update reminder fully      |
| **PATCH**  | `/api/reminders/:id` | Update specific field      |
| **DELETE** | `/api/reminders/:id` | Remove reminder            |

Each route validates data, interacts with MongoDB, and returns JSON responses.

---

## 5. Data Flow Diagram

```
      ┌────────────────────────┐
      │     User Interface     │
      │(Next.js Pages & Forms) │
      └──────────┬─────────────┘
                 │
                 ▼
      ┌────────────────────────┐
      │   Voice & File Parser  │
      │ (speech.ts / fileUpload.ts)
      └──────────┬─────────────┘
                 │
                 ▼
      ┌────────────────────────┐
      │       API Layer        │
      │ (Next.js API Routes)   │
      └──────────┬─────────────┘
                 │
                 ▼
      ┌────────────────────────┐
      │     MongoDB Storage    │
      │ (Mongoose Model)       │
      └────────────────────────┘
```

---

## 6. UI and UX Design

### Design Principles

* **Minimalist interface**
* **Dynamic theming** (dark/light)
* **Mobile responsiveness**
* **Accessible and intuitive controls**

### Core Screens

* **Dashboard:** Displays categorized tasks.
* **Add Reminder:** Allows input through voice, file, or text form.
* **Timer & Stopwatch:** Helps track productivity.
* **Settings:** Manage themes and preferences.

---

## 7. Environment Setup

### 7.1 Prerequisites

* Node.js ≥ 16
* MongoDB (local or Atlas)
* npm or yarn

### 7.2 Installation

```bash
git clone https://github.com/Nehurai/SmartAlarm.git
cd rimix
npm install
```

### 7.3 Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_MONGO_DB_URI="your_mongo_uri"
```

### 7.4 Run Locally

```
npm run dev
```

Open at [http://localhost:3000](http://localhost:3000)

---

## 8. Deployment Guide

### Deploy on Vercel

1. Push project to GitHub.
2. Connect repository to [Vercel](https://vercel.com/).
3. Add environment variables.
4. Click **Deploy**.

Vercel will automatically detect Next.js and configure deployment.

---

## 9. Future Enhancements

| Feature                         | Description                                |
| ------------------------------- | ------------------------------------------ |
| **Authentication**              | Secure login via Email/OAuth               |
| **Team Collaboration**          | Shared lists and multi-user reminders      |
| **AI Categorization**           | Machine learning-based task classification |
| **Mobile App**                  | React Native version with offline mode     |
| **Voice Assistant Integration** | Integration with Alexa/Google Assistant    |

---

## 10. Security and Data Handling

* Uses environment variables for database credentials.
* Validates all API inputs to prevent injection attacks.
* Follows **MongoDB best practices** for schema validation.
* Future integration planned for **JWT-based authentication**.

---

## 11. Developer Notes

* Use TypeScript for all new modules.
* Maintain consistent file naming and functional components.
* Prefer React Hooks over class components.
* Keep utilities stateless and reusable.

---

## 12. License

Licensed under the **MIT License**.
See [`LICENSE`](LICENSE) for full details.

---

## 13. Contributors
* **AYUSHI SHUKLA** – Developer & Designer
  🌐 [LinkedIn](https://www.linkedin.com/in/ayushi-shukla-55021928b)
* **Neha Kumari Rai** – Developer & Designer
  🌐 [LinkedIn](https://www.linkedin.com/in/neha-rai-39996128a?utm_source=share_via&utm_content=profile&utm_medium=member_android)
