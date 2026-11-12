import { useCallback, useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, GraduationCap } from 'lucide-react'
import { Brand } from '../components/AuthPage.jsx'
import { UserDataContext } from '../context/UserDataContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function getLocalDateTimeMinimum() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  })
  const text = await response.text()
  let result = {}
  if (text) {
    try {
      result = JSON.parse(text)
    } catch {
      result = { message: text }
    }
  }
  if (!response.ok) {
    const error = new Error(result.message || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return result
}

async function authenticatedRequest(path, options, refreshSession) {
  try {
    return await request(path, options)
  } catch (error) {
    if (error.status !== 401) throw error
    return request(path, { ...options, token: await refreshSession() })
  }
}

function formatAppointmentDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export default function UserMain() {
  const auth = useContext(UserDataContext)
  const { user, logout, isLoading } = auth
  const navigate = useNavigate()
  const [mentors, setMentors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [isLoadingMentors, setIsLoadingMentors] = useState(true)
  const [bookingMentorId, setBookingMentorId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadDirectory = useCallback(async () => {
    const options = { token: auth.accessToken }
    const [mentorResult, appointmentResult] = await Promise.all([
      authenticatedRequest('/api/user/auth/mentors', options, auth.refreshSession),
      authenticatedRequest('/api/user/auth/appointments', options, auth.refreshSession)
    ])
    setMentors(mentorResult.mentors)
    setAppointments(appointmentResult.appointments)
  }, [auth.accessToken, auth.refreshSession])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => loadDirectory())
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setIsLoadingMentors(false)
      })
    return () => {
      active = false
    }
  }, [loadDirectory])

  async function handleLogout() {
    try {
      await logout()
      navigate('/student/login', { replace: true })
    } catch {
      navigate('/student/login', { replace: true })
    }
  }

  async function handleBookAppointment(event, mentor) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBookingMentorId(mentor._id)
    const scheduledAt = event.currentTarget.elements.scheduledAt.value

    try {
      const result = await authenticatedRequest('/api/user/auth/appointments', {
        method: 'POST',
        body: { mentorId: mentor._id, scheduledAt: new Date(scheduledAt).toISOString() },
        token: auth.accessToken
      }, auth.refreshSession)
      setMessage(result.message)
      await loadDirectory()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBookingMentorId('')
    }
  }

  return (
    <main className="account-page">
      <header className="site-header">
        <Brand />
        <div className="account-header-actions">
          <Link className="profile-back-link" to={`/student/profile/${user?.id}`}>Profile & wallet</Link>
          <button className="account-logout" disabled={isLoading} onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="account-card user-welcome-card">
        <span className="form-eyebrow">STUDENT ACCOUNT</span>
        <h1>Welcome, {user?.username || 'there'}.</h1>
        <p>You’re signed in to your Medix account.</p>
        <dl>
          <div><dt>Email</dt><dd>{user?.email}</dd></div>
          <div><dt>Wallet balance</dt><dd>₹{(Number(user?.wallet) || 0).toLocaleString('en-IN')}</dd></div>
        </dl>
      </section>

      <section className="doctor-directory" aria-labelledby="mentor-directory-title">
        <div className="doctor-directory-heading">
          <div>
            <span className="form-eyebrow">MEDIX MENTORS</span>
            <h2 id="mentor-directory-title">Find a mentor</h2>
            <p>Browse verified mentors and request a mentorship session.</p>
          </div>
          <Link className="directory-profile-link" to={`/student/profile/${user?.id}`}>
            <span>Manage profile</span><ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
        {message && <p className="auth-feedback" role="status">{message}</p>}

        {isLoadingMentors ? (
          <p className="auth-loading">Loading approved mentors…</p>
        ) : mentors.length === 0 ? (
          <p className="directory-empty">No approved mentors are available right now. Please check back soon.</p>
        ) : (
          <div className="doctor-directory-grid">
            {mentors.map((mentor) => (
              <article className="doctor-directory-card" key={mentor._id}>
                <div className="doctor-directory-profile">
                  {mentor.profilePicture
                    ? <img src={mentor.profilePicture} alt="" />
                    : <span className="doctor-directory-avatar-fallback"><GraduationCap size={22} aria-hidden="true" /></span>}
                  <div>
                    <h3>{mentor.username}</h3>
                    <p>{mentor.expertise || 'Mentor'}</p>
                  </div>
                </div>

                {mentor.bio && <p className="doctor-directory-bio">{mentor.bio}</p>}
                <dl className="doctor-directory-details">
                  <div><dt>Experience</dt><dd>{mentor.experienceYears || 0} years</dd></div>
                  <div><dt>Mentor ID</dt><dd>{mentor.mentorId}</dd></div>
                  {mentor.qualifications?.length > 0 && (
                    <div><dt>Qualifications</dt><dd>{mentor.qualifications.join(', ')}</dd></div>
                  )}
                </dl>

                <form className="doctor-booking-form" onSubmit={(event) => handleBookAppointment(event, mentor)}>
                  <label htmlFor={`appointment-${mentor._id}`}>
                    <CalendarDays size={15} aria-hidden="true" /> Preferred session date & time
                  </label>
                  <input
                    id={`appointment-${mentor._id}`}
                    min={getLocalDateTimeMinimum()}
                    name="scheduledAt"
                    required
                    type="datetime-local"
                  />
                  <button
                    className="submit-button"
                    disabled={bookingMentorId === mentor._id}
                    type="submit"
                  >
                    <span>{bookingMentorId === mentor._id ? 'Sending request…' : 'Request session'}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="user-appointments-section" aria-labelledby="user-appointments-title">
        <span className="form-eyebrow">YOUR LEARNING</span>
        <h2 id="user-appointments-title">Mentorship session requests</h2>
        {appointments.length === 0 ? (
          <p className="directory-empty">Your mentorship session requests will show here.</p>
        ) : (
          <div className="user-appointment-list">
            {appointments.map((appointment) => (
              <article className="user-appointment-row" key={appointment._id}>
                <div>
                  <h3>{appointment.mentor?.username || 'Mentor'}</h3>
                  <p>{appointment.mentor?.expertise} · {formatAppointmentDate(appointment.scheduledAt)}</p>
                </div>
                <span className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}>
                  {appointment.status}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
