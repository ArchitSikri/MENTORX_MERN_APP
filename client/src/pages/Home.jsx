import { ArrowUpRight, GraduationCap, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'

const destinations = [
  {
    label: 'Register as a mentor',
    detail: 'Share your knowledge and experience',
    path: '/mentor/register',
    icon: GraduationCap
  },
  {
    label: 'Login as a mentor',
    detail: 'Continue mentoring students',
    path: '/mentor/login',
    icon: GraduationCap
  },
  {
    label: 'Register as a student',
    detail: 'Start learning with a mentor',
    path: '/student/register',
    icon: UserRound
  },
  {
    label: 'Login as a student',
    detail: 'Continue your learning journey',
    path: '/student/login',
    icon: UserRound
  }
]

export default function Home() {
  return (
    <main className="home-page">
      <header className="site-header">
        <Brand />
        <span className="header-note">
          <i className="ri-heart-pulse-line" aria-hidden="true" />
          Learn, grow, connect.
        </span>
      </header>

      <section className="home-content">
        <div className="home-intro">
          <span className="home-eyebrow">A BETTER WAY TO LEARN TOGETHER</span>
          <h1>
            Your future,
            <br />
            <em>guided by mentors.</em>
          </h1>
          <p>
            A community for students seeking guidance and mentors ready to share what they know.
          </p>
          <div className="home-signature">
            <span className="signature-line" />
            <span>Your journey begins here</span>
          </div>
        </div>

        <nav className="destination-list" aria-label="Choose your account">
          <div className="destination-heading">
            <span>WELCOME TO MEDIX</span>
            <span>01 — 04</span>
          </div>
          {destinations.map(({ label, detail, path, icon: Icon }, index) => (
            <Link className="destination-link" key={path} to={path}>
              <span className="destination-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <span className="destination-copy">
                <span className="destination-label">{label}</span>
                <span className="destination-detail">{detail}</span>
              </span>
              <span className="destination-index">0{index + 1}</span>
              <ArrowUpRight className="destination-arrow" size={18} strokeWidth={1.7} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Medix</span>
        <span>Guidance. Growth. Human connection.</span>
        <span className="footer-location">Learn together <span aria-hidden="true">·</span> Grow together</span>
      </footer>
    </main>
  )
}