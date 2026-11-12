import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useContext, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import Home from './pages/Home.jsx'
import MentorRegister from './pages/MentorRegister.jsx'
import MentorLogin from './pages/MentorLogin.jsx'
import UserRegister from './pages/UserRegister.jsx'
import UserLogin from './pages/UserLogin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminRegister from './pages/AdminRegister.jsx'
import AdminMain from './pages/AdminMain.jsx'
import UserMain from './pages/UserMain.jsx'
import UserProfile from './pages/UserProfile.jsx'
import MentorMain from './pages/MentorMain.jsx'
import UserContext from './context/UserContext.jsx'
import MentorContext from './context/MentorContext.jsx'
import { MentorDataContext } from './context/MentorDataContext.js'
import { UserDataContext } from './context/UserDataContext.js'

function AuthGuard({ audience, children }) {
  const isMentor = audience === 'mentor'
  const auth = useContext(isMentor ? MentorDataContext : UserDataContext)
  const loginPath = isMentor ? '/mentor/login' : '/student/login'

  if (auth.isLoading) {
    return <main className="auth-page auth-loading" aria-live="polite">Restoring your session…</main>
  }
  if (!auth.account) return <Navigate to={loginPath} replace />
  return children
}

function AdminGuard({ children }) {
  if (!sessionStorage.getItem('adminAccessToken')) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  const pageRef = useRef(null)

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const animation = gsap.fromTo(
      page,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.48, ease: 'power2.out' }
    )

    return () => animation.kill()
  }, [location.pathname])

  return (
    <div ref={pageRef} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/mentor/register" element={<MentorRegister />} />
        <Route path="/mentor/login" element={<MentorLogin />} />
        <Route path="/student/register" element={<UserRegister />} />
        <Route path="/student/login" element={<UserLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route
          path="/admin/dashboard"
          element={<AdminGuard><AdminMain /></AdminGuard>}
        />
        <Route
          path="/student/dashboard"
          element={<AuthGuard audience="student"><UserMain /></AuthGuard>}
        />
        <Route
          path="/student/profile/:userId"
          element={<AuthGuard audience="student"><UserProfile /></AuthGuard>}
        />
        <Route
          path="/mentor/dashboard"
          element={<AuthGuard audience="mentor"><MentorMain /></AuthGuard>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <UserContext>
      <MentorContext>
        <AnimatedRoutes />
      </MentorContext>
    </UserContext>
  )
}
