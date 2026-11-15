MENTORX


A full-stack student mentorship platform built using the MERN stack, designed to connect students with verified mentors.

## 🚀 Features

- **Mentor Registration & Login** – Mentor profiles include a mentor ID, optional UPI ID, Aadhaar card, and qualification certificate. Email verification and admin approval are required before sign-in.
- **Student Registration & Login** – Students can create accounts and securely log in.
- **Mentor Directory & Sessions** – Students can request sessions with verified, admin-approved mentors; mentors can accept or decline requests.
- **Role-Based Access** – Separate authentication flows for mentors and students.
- **Responsive UI** – Minimal and aesthetic interface with a clean design.
- **Secure Authentication** – Protected routes and authenticated user sessions.
- **Real-Time Communication** – Socket.IO integration for real-time functionality.

## 🛠️ Tech Stack

**Frontend**
- React.js
- Vite
- Tailwind CSS
- Lucide React
- React Remix Icons
- GSAP

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO

**Authentication**
- JWT
- Google OAuth (if enabled)

## 📁 Project Structure

```text
DR-CONSULTANCY/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── App.jsx
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── socket/
│   ├── server.js
│   └── package.json
│
└── README.md
```

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd DR-CONSULTANCY
```

### 2. Setup Backend

```bash
cd server
npm install
```

Create a `.env` file:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Start the backend:

```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd client
npm install
npm run dev
```

## 🔐 Environment Variables

Configure the required environment variables before running the application.

Never commit your `.env` file or expose secret credentials.

For wallet top-ups, add your Razorpay credentials to `server/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_key_secret
```

The secret is only used by the backend. Wallet top-ups accept only Razorpay test-mode key IDs (`rzp_test_`); live-mode keys are rejected.

Signed-in students can manage their profile and add ₹2,000 to their wallet at `/student/profile/:userId`. The wallet is credited only after the backend verifies the Razorpay order, signature, and captured payment.

On the student dashboard, students can browse mentors who have set a session fee and request a future session. Once a mentor accepts, the user can pay from their Medix wallet; the fee is credited to the mentor's in-app Medix wallet, and chat becomes available to both participants. Session wallet transfers use MongoDB transactions, so use MongoDB Atlas or a local replica set. This feature credits the mentor's in-app balance and does not automatically pay out to a bank account or UPI ID.

Paid sessions also support mentor-initiated video calls. Mentors can share their screen and open a collaborative ZEGOCLOUD Superboard from the video-call toolbar; students can view and collaborate on the board. Add `ZEGO_APP_ID` and `ZEGO_SERVER_SECRET` to `server/.env` using the credentials from your ZEGOCLOUD project; the server secret must be exactly 32 bytes. Keep it on the backend—do not add it to a `VITE_` variable or expose it in the client. Superboard is disabled by default for ZEGOCLOUD projects; contact ZEGOCLOUD support to enable the service.

## 🎯 Project Objective

To develop a mentorship platform with dedicated mentor and student workflows, secure authentication, and real-time communication capabilities.

## 👨‍💻 Developer

**Archit Sikri**

- GitHub: [ArchitSikri](https://github.com/ArchitSikri)
- LinkedIn: [Archit Sikri](https://linkedin.com/in/archit-sikri-3741952ba)

---

⭐ If you find this project interesting, consider giving it a star!
