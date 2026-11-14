import { useCallback, useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { MentorDataContext } from '../context/MentorDataContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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
  const result = await response.json().catch(() => ({}))
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

function formatSessionDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export default function MentorMain() {
  const auth = useContext(MentorDataContext)
  const { mentor, logout, isLoading } = auth
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [updatingSessionId, setUpdatingSessionId] = useState('')
  const [sessionFeeInput, setSessionFeeInput] = useState(
    mentor?.sessionFeePaise ? String(mentor.sessionFeePaise / 100) : ''
  )
  const [walletBalance, setWalletBalance] = useState(Number(mentor?.walletBalance) || 0)
  const [isSavingSessionFee, setIsSavingSessionFee] = useState(false)
  const [message, setMessage] = useState('')

  const loadSessions = useCallback(async () => {
    const { appointments, mentorWalletBalance, sessionFeePaise } = await authenticatedRequest(
      '/api/mentor/auth/appointments',
      { token: auth.accessToken },
      auth.refreshSession
    )
    setSessions(appointments)
    setWalletBalance(Number(mentorWalletBalance) || 0)
    setSessionFeeInput(sessionFeePaise ? String(sessionFeePaise / 100) : '')
  }, [auth.accessToken, auth.refreshSession])

  useEffect(() => {
    let active = true
    const refreshSessions = () => {
      Promise.resolve()
        .then(() => loadSessions())
        .catch((requestError) => {
          if (active) setError(requestError.message)
        })
        .finally(() => {
          if (active) setIsLoadingSessions(false)
        })
    }

    refreshSessions()
    const intervalId = window.setInterval(refreshSessions, 15000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [loadSessions])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // The local session is cleared even if the server logout request fails.
    } finally {
      navigate('/mentor/login', { replace: true })
    }
  }

  async function handleSessionDecision(sessionId, status) {
    setError('')
    setUpdatingSessionId(sessionId)
    try {
      await authenticatedRequest(`/api/mentor/auth/appointments/${sessionId}`, {
        method: 'PATCH',
        body: { status },
        token: auth.accessToken
      }, auth.refreshSession)
      await loadSessions()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingSessionId('')
    }
  }

  async function handleSaveSessionFee(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSavingSessionFee(true)
    try {
      const result = await authenticatedRequest('/api/mentor/auth/profile/session-fee', {
        method: 'PATCH',
        body: { sessionFee: Number(sessionFeeInput) },
        token: auth.accessToken
      }, auth.refreshSession)
      auth.setMentor((current) => ({ ...current, sessionFeePaise: result.sessionFeePaise }))
      setSessionFeeInput(String(result.sessionFeePaise / 100))
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSavingSessionFee(false)
    }
  }

  return (
    <main className="account-page">
      <header className="site-header">
        <Brand />
        <button className="account-logout" disabled={isLoading} onClick={handleLogout} type="button">
          Sign out
        </button>
      </header>
      <section className="account-card">
        <span className="form-eyebrow">MENTOR ACCOUNT</span>
        <h1>Welcome, {mentor?.username || 'there'}.</h1>
        <p>You’re signed in to your Medix mentor account.</p>
        <dl>
          <div><dt>Email</dt><dd>{mentor?.email}</dd></div>
          <div><dt>Mentor ID</dt><dd>{mentor?.mentorId}</dd></div>
          {mentor?.expertise && <div><dt>Area of expertise</dt><dd>{mentor.expertise}</dd></div>}
          <div><dt>Account status</dt><dd>{mentor?.status}</dd></div>
          <div><dt>Medix wallet</dt><dd>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd></div>
        </dl>
      </section>
      <section className="doctor-appointments-section mentor-fee-section">
        <h2>Session fee</h2>
        <p>Set the amount students pay when you accept a session request.</p>
        {message && <p className="auth-feedback" role="status">{message}</p>}
        <form className="mentor-fee-form" onSubmit={handleSaveSessionFee}>
          <label htmlFor="mentor-session-fee">Fee per session (₹)</label>
          <input
            id="mentor-session-fee"
            min="0.01"
            max="100000"
            onChange={(event) => setSessionFeeInput(event.target.value)}
            required
            step="0.01"
            type="number"
            value={sessionFeeInput}
          />
          <button
            className="appointment-decision appointment-decision--confirm"
            disabled={isSavingSessionFee}
            type="submit"
          >
            {isSavingSessionFee ? 'Saving…' : 'Save fee'}
          </button>
        </form>
      </section>
      <section className="doctor-appointments-section" aria-labelledby="mentor-sessions-title">
        <span className="form-eyebrow">STUDENT REQUESTS</span>
        <h2 id="mentor-sessions-title">Mentorship session requests</h2>
        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
        {isLoadingSessions ? (
          <p className="auth-loading">Loading session requests…</p>
        ) : sessions.length === 0 ? (
          <p className="directory-empty">You don’t have session requests yet.</p>
        ) : (
          <div className="user-appointment-list">
            {sessions.map((session) => (
              <article className="user-appointment-row doctor-appointment-row" key={session._id}>
                <div>
                  <h3>{session.user?.username || 'Student'}</h3>
                  <p>{session.user?.email} · {formatSessionDate(session.scheduledAt)}</p>
                  {session.reason && <p>Note: {session.reason}</p>}
                  {session.status === 'CONFIRMED' && (
                    <p>
                      Session fee: ₹{(Number(session.sessionFeePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {' · '}Payment: {session.paymentStatus || 'UNPAID'}
                    </p>
                  )}
                </div>
                <div className="doctor-appointment-actions">
                  <span className={`appointment-status appointment-status--${session.status.toLowerCase()}`}>
                    {session.status}
                  </span>
                  {session.status === 'PENDING' && (
                    <>
                      <button
                        className="appointment-decision appointment-decision--confirm"
                        disabled={updatingSessionId === session._id}
                        onClick={() => handleSessionDecision(session._id, 'CONFIRMED')}
                        type="button"
                      >
                        Accept
                      </button>
                      <button
                        className="appointment-decision appointment-decision--reject"
                        disabled={updatingSessionId === session._id}
                        onClick={() => handleSessionDecision(session._id, 'REJECTED')}
                        type="button"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {session.status === 'CONFIRMED' && session.paymentStatus === 'PAID' && (
                    <Link className="appointment-decision appointment-decision--confirm" to={`/mentor/chat/${session._id}`}>
                      Chat with student
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
