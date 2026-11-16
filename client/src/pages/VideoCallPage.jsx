import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'
import { MentorDataContext } from '../context/MentorDataContext.js'
import { UserDataContext } from '../context/UserDataContext.js'

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

export default function VideoCallPage({ role }) {
  const { appointmentId, callId } = useParams()
  const navigate = useNavigate()
  const auth = useContext(role === 'mentor' ? MentorDataContext : UserDataContext)
  const [callState, setCallState] = useState('loading')
  const [error, setError] = useState('')
  const containerRef = useRef(null)
  const zegoRef = useRef(null)
  const joiningRef = useRef(false)
  const leavingRef = useRef(false)
  const authPath = role === 'mentor' ? '/api/mentor/auth' : '/api/user/auth'
  const callPath = `${authPath}/appointments/${appointmentId}/call`
  const chatPath = `/${role === 'mentor' ? 'mentor' : 'student'}/chat/${appointmentId}`

  const leaveCall = useCallback(async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    try {
      await authenticatedRequest(`${callPath}/${callId}/end`, {
        method: 'POST',
        body: {},
        token: auth.accessToken
      }, auth.refreshSession)
      navigate(chatPath, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
      setCallState('ended')
    }
  }, [auth.accessToken, auth.refreshSession, callId, callPath, chatPath, navigate])

  useEffect(() => {
    let active = true
    let loading = false
    let superBoardManager
    let superBoardErrorListener

    const syncCall = async () => {
      if (!active || loading || leavingRef.current) return
      loading = true
      try {
        const { call } = await authenticatedRequest(
          callPath,
          { token: auth.accessToken },
          auth.refreshSession
        )
        if (!active) return
        if (!call || call._id !== callId || !['PENDING', 'ACCEPTED'].includes(call.status)) {
          if (zegoRef.current) {
            leavingRef.current = true
            zegoRef.current.destroy()
            zegoRef.current = null
            navigate(chatPath, { replace: true })
          } else {
            setCallState('ended')
          }
          return
        }
        if (call.status === 'PENDING') {
          setCallState('waiting')
          return
        }
        if (joiningRef.current || zegoRef.current) return

        joiningRef.current = true
        setCallState('joining')
        const credentials = await authenticatedRequest(
          `${callPath}/${callId}/token`,
          { method: 'POST', body: {}, token: auth.accessToken },
          auth.refreshSession
        )
        if (!active) return

        const [{ ZegoUIKitPrebuilt }, { ZegoSuperBoardManager }] = await Promise.all([
          import('@zegocloud/zego-uikit-prebuilt'),
          import('zego-superboard-web')
        ])
        if (!active) return
        superBoardManager = ZegoSuperBoardManager.getInstance()
        superBoardErrorListener = ({ code, message }) => {
          if (!active) return
          const description = code === 3100006
            ? 'Superboard is rate-limiting requests. Wait a few seconds before trying again.'
            : message
          setError(`Superboard error ${code}: ${description}`)
        }
        superBoardManager.on('error', superBoardErrorListener)
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          credentials.appId,
          credentials.token,
          credentials.roomId,
          credentials.userId,
          credentials.userName
        )
        const zego = ZegoUIKitPrebuilt.create(kitToken)
        zego.addPlugins({ ZegoSuperBoardManager })
        zegoRef.current = zego
        zego.joinRoom({
          container: containerRef.current,
          maxUsers: 2,
          scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
          showPreJoinView: false,
          showScreenSharingButton: role === 'mentor',
          whiteboardConfig: {
            showCreateAndCloseButton: role === 'mentor'
          },
          onLeaveRoom: () => {
            if (active) void leaveCall()
          }
        })
        setCallState('in-call')
      } catch (requestError) {
        joiningRef.current = false
        zegoRef.current?.destroy()
        zegoRef.current = null
        if (active) {
          setError(requestError.message)
          setCallState('error')
        }
      } finally {
        loading = false
      }
    }

    syncCall()
    const intervalId = window.setInterval(syncCall, 3000)
    return () => {
      active = false
      window.clearInterval(intervalId)
      if (superBoardManager && superBoardErrorListener) {
        superBoardManager.off('error', superBoardErrorListener)
      }
      zegoRef.current?.destroy()
      zegoRef.current = null
    }
  }, [auth.accessToken, auth.refreshSession, callId, callPath, chatPath, leaveCall, navigate, role])

  const statusText = {
    loading: 'Checking call invitation…',
    waiting: 'Waiting for the builder to accept the call…',
    joining: 'Connecting to the video call…',
    'in-call': 'You are in the call.',
    ended: 'This video call has ended.',
    error: 'Unable to join the video call.'
  }[callState]

  return (
    <main className="account-page video-call-page">
      <header className="site-header">
        <Brand />
        <Link className="profile-back-link" to={chatPath}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to chat</span>
        </Link>
      </header>
      <section className="video-call-card" aria-labelledby="video-call-title">
        <div className="chat-heading">
          <span className="form-eyebrow">MENTORX VIDEO SESSION</span>
          <h1 id="video-call-title">Mentorship call</h1>
          <p aria-live="polite">{statusText}</p>
        </div>
        <p className="video-call-guidance">
          {role === 'mentor'
            ? 'Use the call toolbar to share your screen or open the collaborative Superboard.'
            : "Your mentor's shared screen or Superboard will appear here."}
        </p>
        {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
        <div
          className={`video-call-room${callState === 'in-call' ? ' video-call-room--active' : ''}`}
          ref={containerRef}
        />
        {(callState === 'ended' || callState === 'error') && (
          <Link className="appointment-decision appointment-decision--confirm" to={chatPath}>
            Return to chat
          </Link>
        )}
      </section>
    </main>
  )
}
