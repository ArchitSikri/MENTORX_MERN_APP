import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Check, Code2, FileText, LogOut, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const documents = [
  { field: 'Adhar_Card', label: 'Aadhaar card' },
  { field: 'qualificationCertificate', label: 'Qualification certificate' }
]

function displayDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export default function AdminMain() {
  const navigate = useNavigate()
  const [mentors, setMentors] = useState([])
  const [selectedMentorId, setSelectedMentorId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [actionMentorId, setActionMentorId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const selectedMentor = mentors.find((mentor) => mentor._id === selectedMentorId)

  useEffect(() => {
    const token = sessionStorage.getItem('adminAccessToken')
    if (!token) {
      navigate('/admin/login', { replace: true })
      return undefined
    }

    let active = true
    async function loadPendingMentors() {
      setIsLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/mentors/pending`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        })
        const result = await response.json().catch(() => ({}))
        if (response.status === 401) {
          sessionStorage.removeItem('adminAccessToken')
          navigate('/admin/login', { replace: true })
          return
        }
        if (!response.ok) throw new Error(result.message || 'Unable to load pending mentors.')
        if (active) {
          const pendingMentors = Array.isArray(result.mentors) ? result.mentors : []
          setMentors(pendingMentors)
          setSelectedMentorId((currentId) =>
            pendingMentors.some((mentor) => mentor._id === currentId)
              ? currentId
              : pendingMentors[0]?._id ?? null
          )
        }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load pending mentors.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    const socket = io(API_BASE_URL || window.location.origin)
    socket.on('mentor:registered', loadPendingMentors)
    loadPendingMentors()
    return () => {
      active = false
      socket.disconnect()
    }
  }, [navigate, reloadKey])

  async function handleDecision(decision) {
    if (!selectedMentor) return
    if (decision === 'reject' && !window.confirm(`Reject ${selectedMentor.username}'s application?`)) return

    setActionMentorId(selectedMentor._id)
    setError('')
    setNotice('')
    try {
      const token = sessionStorage.getItem('adminAccessToken')
      const response = await fetch(
        `${API_BASE_URL}/api/admin/mentors/${selectedMentor._id}/${decision}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        }
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || `Unable to ${decision} mentor.`)

      setNotice(result.message || `Mentor ${decision}ed successfully.`)
      setMentors((current) => current.filter((mentor) => mentor._id !== selectedMentor._id))
      setSelectedMentorId(null)
    } catch (requestError) {
      setError(requestError.message || `Unable to ${decision} mentor.`)
    } finally {
      setActionMentorId(null)
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    const token = sessionStorage.getItem('adminAccessToken')
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/admin/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        })
      }
    } finally {
      sessionStorage.removeItem('adminAccessToken')
      navigate('/admin/login', { replace: true })
    }
  }

  return (
    <main className="min-h-screen bg-paper px-5 text-ink sm:px-8">
      <header className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between border-b border-line">
        <Link className="text-xl font-semibold text-ink no-underline" to="/">
          <><Code2 className="mr-2 inline-block" size={18} aria-hidden="true" />Mentor<span className="text-accent">X</span></>
        </Link>
        <button
          className="inline-flex items-center gap-2 border-0 bg-transparent text-xs text-muted hover:text-accent disabled:opacity-60"
          disabled={isLoggingOut}
          onClick={handleLogout}
          type="button"
        >
          <LogOut size={16} aria-hidden="true" />
          {isLoggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      <section className="mx-auto max-w-[1180px] py-8 sm:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-accent">
              <ShieldCheck size={16} aria-hidden="true" /> MENTORX ADMINISTRATION
            </p>
            <h1 className="mb-1 font-display text-3xl font-medium text-ink">Mentor applications</h1>
            <p className="m-0 text-sm text-muted">Review mentor IDs and verification documents.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{mentors.length} pending</span>
            <button
              aria-label="Refresh applications"
              className="grid size-9 place-items-center border border-line bg-white text-ink hover:text-accent disabled:opacity-50"
              disabled={isLoading}
              onClick={() => setReloadKey((key) => key + 1)}
              title="Refresh applications"
              type="button"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-700" role="alert">{error}</p>}
        {notice && <p className="mb-4 text-sm text-green-800" role="status">{notice}</p>}

        {isLoading && mentors.length === 0 ? (
          <p className="py-10 text-sm text-muted" aria-live="polite">Loading applications…</p>
        ) : mentors.length === 0 ? (
          <p className="border-y border-line py-10 text-sm text-muted">No pending mentor applications.</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
            <section aria-label="Pending mentor applications">
              {mentors.map((mentor) => (
                <button
                  aria-pressed={mentor._id === selectedMentorId}
                  className={`block w-full border-b border-line px-3 py-4 text-left transition-colors ${mentor._id === selectedMentorId ? 'bg-white' : 'bg-transparent hover:bg-white/70'}`}
                  key={mentor._id}
                  onClick={() => setSelectedMentorId(mentor._id)}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <strong className="block text-sm font-medium text-ink">{mentor.username}</strong>
                      <span className="mt-1 block text-xs text-muted">{mentor.expertise || mentor.mentorId}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">{displayDate(mentor.createdAt)}</span>
                  </span>
                  <span className={`mt-2 block text-[10px] ${mentor.verified ? 'text-green-800' : 'text-amber-800'}`}>
                    {mentor.verified ? 'Email verified' : 'Email verification pending'}
                  </span>
                </button>
              ))}
            </section>

            {selectedMentor && (
              <section className="min-w-0" aria-labelledby="mentor-detail-title">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <p className="mb-1 text-[10px] font-medium tracking-[0.08em] text-accent">APPLICATION DETAILS</p>
                    <h2 className="m-0 font-display text-2xl font-medium" id="mentor-detail-title">
                      {selectedMentor.username}
                    </h2>
                  </div>
                  <span className="text-xs text-muted">Submitted {displayDate(selectedMentor.createdAt)}</span>
                </div>

                <dl className="grid gap-x-6 gap-y-4 border-b border-line py-5 sm:grid-cols-2">
                  {[
                    ['Email', selectedMentor.email],
                    ['Mentor ID', selectedMentor.mentorId],
                    ['UPI ID', selectedMentor.UPI_Id || '—'],
                    ['Area of expertise', selectedMentor.expertise || '—'],
                    ['Experience', `${selectedMentor.experienceYears ?? 0} years`],
                    ['Email verification', selectedMentor.verified ? 'Verified' : 'Not verified'],
                    ['Qualifications', Array.isArray(selectedMentor.qualifications) ? selectedMentor.qualifications.join(', ') || '—' : '—']
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] font-medium text-muted">{label}</dt>
                      <dd className="mt-1 wrap-break-word text-xs text-ink">{value}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-medium text-muted">About</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">{selectedMentor.bio || '—'}</dd>
                  </div>
                </dl>

                <div className="py-5">
                  <h3 className="mb-3 text-xs font-semibold text-ink">Submitted documents</h3>
                  <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                    {documents.filter(({ field }) => selectedMentor[field]).map(({ field, label }) => (
                      <li key={field}>
                        <a
                          className="inline-flex min-h-10 items-center gap-2 border border-line bg-white px-3 text-xs text-ink no-underline hover:border-accent hover:text-accent"
                          href={selectedMentor[field]}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <FileText size={15} aria-hidden="true" /> {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {!selectedMentor.verified && (
                  <p className="border-l-2 border-amber-600 pl-3 text-xs leading-5 text-muted">
                    Mentor sign-in requires email OTP verification.
                  </p>
                )}

                <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                  <button
                    className="inline-flex min-h-10 items-center gap-2 border border-green-800 bg-green-800 px-4 text-xs font-medium text-white hover:bg-green-900 disabled:opacity-50"
                    disabled={actionMentorId === selectedMentor._id}
                    onClick={() => handleDecision('approve')}
                    type="button"
                  >
                    <Check size={15} aria-hidden="true" /> Approve
                  </button>
                  <button
                    className="inline-flex min-h-10 items-center gap-2 border border-red-800 bg-white px-4 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                    disabled={actionMentorId === selectedMentor._id}
                    onClick={() => handleDecision('reject')}
                    type="button"
                  >
                    <X size={15} aria-hidden="true" /> Reject
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
