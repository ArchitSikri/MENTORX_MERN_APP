import { ArrowUpRight, Code2, GraduationCap, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'

const destinations = [
  {
    label: 'Join as a mentor',
    detail: 'Share your craft and experience',
    path: '/mentor/register',
    icon: GraduationCap
  },
  {
    label: 'Mentor sign in',
    detail: 'Keep guiding the next generation',
    path: '/mentor/login',
    icon: GraduationCap
  },
  {
    label: 'Join as a builder',
    detail: 'Learn by building with a mentor',
    path: '/student/register',
    icon: UserRound
  },
  {
    label: 'Builder sign in',
    detail: 'Pick up where your next idea left off',
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
          <Code2 size={16} aria-hidden="true" />
          Think. Build. Level up.
        </span>
      </header>

      <section className="home-content">
        <div className="home-intro">
          <span className="home-eyebrow">YOUR NEXT BIG IDEA STARTS HERE</span>
          <h1>
            Build what’s
            <br />
            <em>next, together.</em>
          </h1>
          <p>
            Find your people, sharpen your skills, and turn ambitious ideas into things that work.
          </p>
          <div className="home-signature">
            <span className="signature-line" />
            <span>Make progress, one project at a time</span>
          </div>
        </div>

        <nav className="destination-list" aria-label="Choose your account">
          <div className="destination-heading">
            <span>WELCOME TO MENTORX</span>
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
        <span>© {new Date().getFullYear()} MentorX</span>
        <span>Curiosity. Craft. Community.</span>
        <span className="footer-location">Dream it <span aria-hidden="true">·</span> Build it</span>
      </footer>
    </main>
  )
}