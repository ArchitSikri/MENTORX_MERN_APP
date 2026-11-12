import { useContext, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, FileUp, GraduationCap, LockKeyhole, Mail, UserRound, Wallet } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { MentorDataContext } from '../context/MentorDataContext.js'
import { UserDataContext } from '../context/UserDataContext.js'

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Medix home">
      <span className="brand-mark" aria-hidden="true">
        <i className="ri-heart-pulse-line" />
      </span>
      <span className="brand-name">medix<span>.</span></span>
    </Link>
  )
}

function PasswordField({ id, label, placeholder, isRegister, required = false }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <LockKeyhole className="field-icon" size={17} strokeWidth={1.7} aria-hidden="true" />
        <input
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          id={id}
          name={id}
          placeholder={placeholder}
          required={required}
          minLength={isRegister ? 8 : undefined}
          type={visible ? 'text' : 'password'}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible
            ? <EyeOff size={17} strokeWidth={1.7} aria-hidden="true" />
            : <Eye size={17} strokeWidth={1.7} aria-hidden="true" />}
        </button>
      </span>
    </label>
  )
}

function TextField({ id, name = id, label, placeholder, type = 'text', icon: Icon, autoComplete, required = false }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">
        {label}
        {required && <span className="field-required">Required</span>}
      </span>
      <span className="input-wrap">
        <Icon className="field-icon" size={17} strokeWidth={1.7} aria-hidden="true" />
        <input
          autoComplete={autoComplete}
          id={id}
          name={name}
          placeholder={placeholder}
          required={required}
          type={type}
        />
      </span>
    </label>
  )
}

function FileField({
  id,
  name = id,
  label,
  required = false,
  accept = 'image/jpeg,image/png,image/webp,image/gif,image/bmp',
  hint = 'JPG, PNG or WEBP · max 5 MB'
}) {
  return (
    <label className="field file-field" htmlFor={id}>
      <span className="field-label">
        {label}
        <span className={required ? 'field-required' : 'field-optional'}>
          {required ? 'Required' : 'Optional'}
        </span>
      </span>
      <span className="file-input-wrap">
        <span className="file-input-icon" aria-hidden="true">
          <FileUp size={18} strokeWidth={1.7} />
        </span>
        <span className="file-input-copy">
          <span>Choose a file</span>
          <small>{hint}</small>
        </span>
        <input
          accept={accept}
          id={id}
          name={name}
          required={required}
          type="file"
        />
      </span>
    </label>
  )
}

export default function AuthPage({ audience, mode }) {
  const userAuth = useContext(UserDataContext)
  const mentorAuth = useContext(MentorDataContext)
  const auth = audience === 'mentor' ? mentorAuth : userAuth
  const navigate = useNavigate()
  const [stage, setStage] = useState('form')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const isMentor = audience === 'mentor'
  const isRegister = mode === 'register'
  const isMentorRegistration = isMentor && isRegister
  const showGoogleAuth = !isMentor && stage === 'form'
  const audienceLabel = isMentor ? 'Mentor' : 'Student'
  const pageTitle = isRegister ? 'Create your account' : 'Welcome back'
  const pageDescription = isRegister
    ? 'A few details are all we need to get you started.'
    : 'Sign in to continue to your Medix account.'
  const alternatePath = isMentor
    ? (isRegister ? '/mentor/login' : '/mentor/register')
    : (isRegister ? '/student/login' : '/student/register')

  useEffect(() => {
    if (!isRegister && auth.account) {
      navigate(isMentor ? '/mentor/dashboard' : '/student/dashboard', { replace: true })
    }
  }, [auth.account, isMentor, isRegister, navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    auth.setError('')
    setStatusMessage('')
    const formData = new FormData(event.currentTarget)

    try {
      if (stage === 'verify') {
        const result = await auth.verifyEmail(
          verificationEmail,
          String(formData.get('otp') || '').trim()
        )
        setStatusMessage(result.message)
        setStage('verified')
        return
      }

      const email = String(formData.get('email') || '').trim().toLowerCase()
      if (isRegister) {
        const password = String(formData.get('password') || '')
        if (password !== formData.get('confirm-password')) {
          auth.setError('Passwords do not match.')
          return
        }

        const registrationData = new FormData()
        for (const [key, value] of formData.entries()) {
          if (key === 'confirm-password') continue
          if (typeof value === 'string' && !value.trim()) continue
          if (value instanceof File && !value.name) continue
          registrationData.append(key, value)
        }
        const result = await auth.register(registrationData)
        setVerificationEmail(email)
        setStatusMessage(result.message)
        setStage('verify')
        return
      }

      await auth.login({
        email,
        password: String(formData.get('password') || '')
      })
      navigate(isMentor ? '/mentor/dashboard' : '/student/dashboard', { replace: true })
    } catch {
      // The context stores request errors for the form to display.
    }
  }

  async function handleGoogleSuccess(response) {
    auth.setError('')
    setStatusMessage('')
    try {
      await auth.googleLogin(response.credential)
      navigate('/student/dashboard', { replace: true })
    } catch {
      // The context stores request errors for the form to display.
    }
  }

  return (
    <main className="auth-page">
      <header className="site-header auth-header">
        <Brand />
        <Link className="back-link" to="/">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </header>

      <div className={`auth-layout${isMentorRegistration ? ' auth-layout--doctor-register' : ''}`}>
        <section className="auth-intro" aria-label={`${audienceLabel} access`}>
          <div className="intro-kicker">
            {isMentor
              ? <GraduationCap size={15} strokeWidth={1.7} aria-hidden="true" />
              : <UserRound size={15} strokeWidth={1.7} aria-hidden="true" />}
            <span>{audienceLabel}</span>
          </div>
          <h1>
            Guidance that feels
            <br />
            <em>closer.</em>
          </h1>
          <p>
            Learning grows through a more human connection.
            We’re glad you’re here.
          </p>
          <div className="intro-rule" />
          <span className="intro-note">A little more guidance, in every connection.</span>
        </section>

        <section className={`auth-form-panel${isMentorRegistration ? ' auth-form-panel--doctor' : ''}`} aria-labelledby="form-title">
          <div className="form-heading">
            <span className="form-eyebrow">
              {isMentorRegistration ? 'MENTOR REGISTRATION' : isRegister ? 'STUDENT REGISTRATION' : 'YOUR ACCOUNT'}
            </span>
            <h2 id="form-title">
              {stage === 'verify'
                ? 'Verify your email'
                : stage === 'verified'
                  ? 'Email verified'
                  : isMentorRegistration
                    ? 'Your mentor profile'
                    : pageTitle}
            </h2>
            <p>
              {stage === 'verify'
                ? `Enter the verification code sent to ${verificationEmail}.`
                : stage === 'verified'
                  ? (isMentor
                    ? 'Your profile is now waiting for administrator approval.'
                    : 'Your account is ready. Sign in to continue.')
                  : isMentorRegistration
                    ? 'Share your details and documents to create your mentor profile.'
                    : pageDescription}
            </p>
          </div>

          {auth.error && <p className="auth-feedback auth-feedback--error" role="alert">{auth.error}</p>}
          {statusMessage && <p className="auth-feedback" role="status">{statusMessage}</p>}

          {stage === 'verified' ? (
            <Link className="submit-button auth-action-link" to={alternatePath}>
              <span>{isMentor ? 'Continue to sign in' : 'Sign in to your account'}</span>
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          ) : (
          <form
            className={`auth-form${isMentorRegistration ? ' auth-form--doctor' : isRegister ? ' auth-form--user-register' : ''}`}
            onSubmit={handleSubmit}
          >
            {stage === 'verify' ? (
              <>
                <input name="email" type="hidden" value={verificationEmail} />
                <TextField
                  autoComplete="one-time-code"
                  icon={LockKeyhole}
                  id="otp"
                  label="Email verification code"
                  name="otp"
                  placeholder="Enter your 6-digit code"
                  required
                />
              </>
            ) : isMentorRegistration ? (
              <>
              <div className="form-section-heading">
                <span className="form-section-number">01</span>
                <div>
                  <h3>Account details</h3>
                  <p>Your sign-in and profile information</p>
                </div>
              </div>
              <TextField
                autoComplete="name"
                icon={UserRound}
                id="full-name"
                name="username"
                label="Full name"
                placeholder="Your full name"
                required
              />
              <TextField
                autoComplete="email"
                icon={Mail}
                id="email"
                label="Email address"
                placeholder="you@example.com"
                required
                type="email"
              />
              <PasswordField
                id="password"
                isRegister={isRegister}
                label="Password"
                placeholder="Create a password"
                required
              />
              <PasswordField
                id="confirm-password"
                isRegister={isRegister}
                label="Confirm password"
                placeholder="Enter your password again"
                required
              />
              <FileField id="profilePicture" label="Profile picture" />
              <TextField
                autoComplete="off"
                icon={Wallet}
                id="UPI_Id"
                label="UPI ID"
                placeholder="name@bank"
              />

              <div className="form-section-heading">
                <span className="form-section-number">02</span>
                <div>
                  <h3>Mentor profile</h3>
                  <p>Share your experience and areas of expertise</p>
                </div>
              </div>
                <TextField
                  autoComplete="off"
                  icon={GraduationCap}
                  id="mentorId"
                  label="Mentor ID"
                  placeholder="Your institution or organization ID"
                  required
                />
              <TextField
                autoComplete="organization-title"
                  icon={GraduationCap}
                  id="expertise"
                  label="Area of expertise"
                  placeholder="e.g. Software engineering, Mathematics"
              />
              <TextField
                autoComplete="off"
                  icon={GraduationCap}
                id="qualifications"
                  label="Qualifications"
                  placeholder="e.g. B.Tech, M.Sc."
              />
              <TextField
                autoComplete="off"
                  icon={GraduationCap}
                id="experienceYears"
                label="Years of experience"
                placeholder="e.g. 8"
                type="number"
              />
              <label className="field doctor-bio-field" htmlFor="bio">
                  <span className="field-label">About you <span className="field-optional">Optional</span></span>
                <textarea
                  className="bio-input"
                  id="bio"
                  name="bio"
                    placeholder="Briefly introduce your experience and mentoring approach"
                  rows="3"
                />
              </label>

              <div className="form-section-heading">
                <span className="form-section-number">03</span>
                <div>
                  <h3>Verification documents</h3>
                  <p>Upload documents for admin review</p>
                </div>
              </div>
              <FileField id="Adhar_Card" label="Aadhaar card" required />
                <FileField
                  id="qualificationCertificate"
                  label="Qualification certificate"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  hint="PDF, JPG, PNG or WEBP · max 5 MB"
                  required
                />
              <p className="upload-note">
                  Your documents are submitted for mentor verification.
              </p>
              </>
            ) : (
              <>
              {isRegister && (
                <TextField
                  autoComplete="name"
                  icon={UserRound}
                  id="full-name"
                  name="username"
                  required={isRegister}
                  label="Full name"
                  placeholder="Your full name"
                />
              )}
              {isRegister && <FileField id="profilePicture" label="Profile picture" />}
              <TextField
                autoComplete="email"
                icon={Mail}
                id="email"
                label="Email address"
                placeholder="you@example.com"
                type="email"
                required
              />
              <PasswordField
                id="password"
                isRegister={isRegister}
                label="Password"
                placeholder={isRegister ? 'Create a password' : 'Enter your password'}
                required
              />
              {isRegister && (
                <PasswordField
                  id="confirm-password"
                  isRegister={isRegister}
                  label="Confirm password"
                  placeholder="Enter your password again"
                  required
                />
              )}
              </>
            )}
            <button className="submit-button" disabled={auth.isLoading} type="submit">
              <span>
                {auth.isLoading
                  ? 'Please wait…'
                  : stage === 'verify'
                    ? 'Verify email'
                    : isMentorRegistration
                      ? 'Continue with registration'
                      : isRegister
                        ? 'Create account'
                        : 'Sign in'}
              </span>
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </form>
          )}

          {showGoogleAuth && (
            <div className="google-auth">
              <span className="google-auth-divider">or continue with</span>
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => auth.setError('Google sign-in was cancelled or failed. Please try again.')}
                  text={isRegister ? 'signup_with' : 'signin_with'}
                  shape="rectangular"
                  theme="outline"
                  width="320"
                />
              ) : (
                <p className="google-auth-note">
                  Google sign-in is unavailable until <code>VITE_GOOGLE_CLIENT_ID</code> is configured.
                </p>
              )}
            </div>
          )}

          {stage !== 'verified' && (
            <>
              <p className="form-switch">
                {isRegister ? 'Already have an account?' : 'New to Medix?'}
                {' '}
                <Link to={alternatePath}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
              </p>
              <p className="form-footnote">
                By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
              </p>
            </>
          )}
        </section>
      </div>

      <footer className="site-footer auth-footer">
        <span>© {new Date().getFullYear()} Medix</span>
        <span>Here for your growth.</span>
      </footer>
    </main>
  )
}

export { Brand }
