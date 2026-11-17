import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, PhoneCall, Send, Video, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { MentorDataContext } from '../context/MentorDataContext.js'
import { UserDataContext } from '../context/UserDataContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const allowedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp'
])

async function request(path, { method = 'GET', body, token } = {}) {
  const isFormData = body instanceof FormData
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
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

function formatMessageTime(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export default function ChatPage({ role }) {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const auth = useContext(role === 'mentor' ? MentorDataContext : UserDataContext)
  const [messages, setMessages] = useState([])
  const [call, setCall] = useState(null)
  const [draft, setDraft] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const [callResponse, setCallResponse] = useState('')
  const messageListRef = useRef(null)
  const imageInputRef = useRef(null)
  const imagePreviewUrlRef = useRef('')
  const authPath = role === 'mentor' ? '/api/mentor/auth' : '/api/user/auth'
  const backPath = role === 'mentor' ? '/mentor/dashboard' : '/student/dashboard'
  const ownId = role === 'mentor' ? auth.mentor?.id : auth.user?.id
  const callPath = `${authPath}/appointments/${appointmentId}/call`

  const loadMessages = useCallback(async () => {
    const result = await authenticatedRequest(
      `${authPath}/appointments/${appointmentId}/messages`,
      { token: auth.accessToken },
      auth.refreshSession
    )
    setMessages(result.messages)
  }, [appointmentId, auth.accessToken, auth.refreshSession, authPath])

  const loadCall = useCallback(async () => {
    const result = await authenticatedRequest(
      callPath,
      { token: auth.accessToken },
      auth.refreshSession
    )
    setCall(result.call)
  }, [auth.accessToken, auth.refreshSession, callPath])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        await loadMessages()
        if (active) setError('')
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    refresh()
    const intervalId = window.setInterval(refresh, 5000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [loadMessages])

  useEffect(() => {
    let active = true
    const refreshCall = async () => {
      try {
        await loadCall()
        if (active) setCallResponse('')
      } catch (requestError) {
        if (active) setCallResponse(requestError.message)
      }
    }

    refreshCall()
    const intervalId = window.setInterval(refreshCall, 3000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [loadCall])

  useEffect(() => {
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  useEffect(() => () => {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current)
  }, [])

  function handleImageSelection(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!allowedImageTypes.has(file.type)) {
      setError('Choose a JPG, PNG, GIF, WEBP, or BMP image.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Images must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setError('')
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current)
    imagePreviewUrlRef.current = URL.createObjectURL(file)
    setImagePreview(imagePreviewUrlRef.current)
    setSelectedImage(file)
  }

  function removeSelectedImage() {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current)
    imagePreviewUrlRef.current = ''
    setImagePreview('')
    setSelectedImage(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text && !selectedImage) return

    const body = new FormData()
    if (text) body.append('text', text)
    if (selectedImage) body.append('image', selectedImage)

    setError('')
    setIsSending(true)
    try {
      await authenticatedRequest(
        `${authPath}/appointments/${appointmentId}/messages`,
        {
          method: 'POST',
          body,
          token: auth.accessToken
        },
        auth.refreshSession
      )
      setDraft('')
      removeSelectedImage()
      await loadMessages()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  async function handleStartCall() {
    setCallResponse('')
    setIsCalling(true)
    try {
      const result = await authenticatedRequest(callPath, {
        method: 'POST',
        body: {},
        token: auth.accessToken
      }, auth.refreshSession)
      navigate(`/mentor/video-call/${appointmentId}/${result.call._id}`)
    } catch (requestError) {
      setCallResponse(requestError.message)
    } finally {
      setIsCalling(false)
    }
  }

  async function handleCallResponse(status) {
    if (!call) return

    setCallResponse('')
    setIsCalling(true)
    try {
      await authenticatedRequest(`${callPath}/${call._id}`, {
        method: 'PATCH',
        body: { status },
        token: auth.accessToken
      }, auth.refreshSession)
      if (status === 'ACCEPTED') {
        navigate(`/student/video-call/${appointmentId}/${call._id}`)
      } else {
        await loadCall()
      }
    } catch (requestError) {
      setCallResponse(requestError.message)
    } finally {
      setIsCalling(false)
    }
  }

  function getVideoCallPath() {
    return `/${role === 'mentor' ? 'mentor' : 'student'}/video-call/${appointmentId}/${call._id}`
  }

  return (
    <main className="account-page chat-page">
      <header className="site-header">
        <Brand />
        <Link className="profile-back-link" to={backPath}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to dashboard</span>
        </Link>
      </header>
      <section className="chat-card" aria-labelledby="chat-title">
        <div className="chat-heading">
          <span className="form-eyebrow">PAID MENTORSHIP SESSION</span>
          <h1 id="chat-title">Chat with {role === 'mentor' ? 'builder' : 'mentor'}</h1>
          <p>Messages are available to the participants of this paid session.</p>
        </div>
        <section className="chat-call-panel" aria-label="Video call">
          {role === 'mentor' && !call && (
            <button
              className="appointment-decision appointment-decision--confirm chat-call-button"
              disabled={isCalling}
              onClick={handleStartCall}
              type="button"
            >
              <Video size={16} aria-hidden="true" />
              {isCalling ? 'Starting call…' : 'Start video call'}
            </button>
          )}
          {role === 'user' && call?.status === 'PENDING' && (
            <div className="chat-incoming-call">
              <p><PhoneCall size={17} aria-hidden="true" /> Your mentor is inviting you to a video call.</p>
              <div className="chat-call-actions">
                <button
                  className="appointment-decision appointment-decision--confirm"
                  disabled={isCalling}
                  onClick={() => handleCallResponse('ACCEPTED')}
                  type="button"
                >
                  {isCalling ? 'Joining…' : 'Accept call'}
                </button>
                <button
                  className="appointment-decision appointment-decision--reject"
                  disabled={isCalling}
                  onClick={() => handleCallResponse('DECLINED')}
                  type="button"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
          {call?.status === 'PENDING' && role === 'mentor' && (
            <div className="chat-incoming-call">
              <p>Waiting for the builder to accept your video call.</p>
              <Link className="appointment-decision appointment-decision--confirm" to={getVideoCallPath()}>
                Return to call
              </Link>
            </div>
          )}
          {call?.status === 'ACCEPTED' && (
            <div className="chat-incoming-call">
              <p>Your video call is ready to join.</p>
              <Link className="appointment-decision appointment-decision--confirm" to={getVideoCallPath()}>
                Join video call
              </Link>
            </div>
          )}
          {callResponse && <p className="auth-feedback auth-feedback--error" role="alert">{callResponse}</p>}
        </section>
        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
        <div aria-live="polite" className="chat-message-list" ref={messageListRef}>
          {isLoading ? (
            <p className="auth-loading">Loading conversation…</p>
          ) : messages.length === 0 ? (
            <p className="directory-empty">Start the conversation with a message.</p>
          ) : messages.map((message) => (
            <article
              className={`chat-message${String(message.senderId) === String(ownId) ? ' chat-message--own' : ''}`}
              key={message._id}
            >
              <div className="chat-message-meta">
                <strong>{message.senderName}</strong>
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
              </div>
              {message.text && <p>{message.text}</p>}
              {message.imageUrl && (
                <a className="chat-message-image-link" href={message.imageUrl} rel="noreferrer" target="_blank">
                  <img
                    alt={message.text ? 'Image attached to message' : 'Image sent in chat'}
                    className="chat-message-image"
                    loading="lazy"
                    src={message.imageUrl}
                  />
                </a>
              )}
            </article>
          ))}
        </div>
        {selectedImage && (
          <div className="chat-image-preview">
            <img alt="Selected image preview" src={imagePreview} />
            <span>{selectedImage.name}</span>
            <button
              aria-label="Remove selected image"
              disabled={isSending}
              onClick={removeSelectedImage}
              type="button"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}
        <form className="chat-compose-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-message">Message</label>
          <textarea
            id="chat-message"
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message…"
            rows={2}
            value={draft}
          />
          <input
            accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
            className="sr-only"
            onChange={handleImageSelection}
            ref={imageInputRef}
            type="file"
          />
          <button
            aria-label="Attach an image"
            className="chat-image-button"
            disabled={isSending}
            onClick={() => imageInputRef.current?.click()}
            type="button"
          >
            <ImagePlus size={18} aria-hidden="true" />
          </button>
          <button className="submit-button" disabled={isSending || (!draft.trim() && !selectedImage)} type="submit">
            <span>{isSending ? 'Sending…' : 'Send'}</span>
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  )
}
