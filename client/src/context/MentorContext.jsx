import { useAuthSession } from './authSession.js'
import { MentorDataContext } from './MentorDataContext.js'

export default function MentorContext({ children }) {
  const auth = useAuthSession({
    role: 'mentor',
    authPath: '/api/mentor/auth',
    accountKey: 'mentor'
  })

  return (
    <MentorDataContext.Provider value={{ ...auth, mentor: auth.account, setMentor: auth.setAccount }}>
      {children}
    </MentorDataContext.Provider>
  )

}
