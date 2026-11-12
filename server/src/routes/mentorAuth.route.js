import { Router } from 'express';
import {
    getMentorMe,
    loginMentor,
    logoutAllMentorSessions,
    logoutMentor,
    refreshMentorToken,
    registerMentor,
    verifyMentorEmail
} from '../controllers/mentorAuth.controller.js';
import { authMentor } from '../middleware/authMiddleware.js';
import { uploadMentorDocuments } from '../middleware/multer.middleware.js';
import {
    listMentorAppointments,
    updateAppointmentStatus
} from '../controllers/appointment.controller.js';

const mentorAuthRouter = Router();

mentorAuthRouter.post('/register', uploadMentorDocuments, registerMentor);
mentorAuthRouter.post('/verify-email', verifyMentorEmail);
mentorAuthRouter.post('/login', loginMentor);
mentorAuthRouter.post('/refresh', refreshMentorToken);
mentorAuthRouter.get('/me', authMentor, getMentorMe);
mentorAuthRouter.get('/appointments', authMentor, listMentorAppointments);
mentorAuthRouter.patch('/appointments/:appointmentId', authMentor, updateAppointmentStatus);
mentorAuthRouter.post('/logout', authMentor, logoutMentor);
mentorAuthRouter.post('/logout-all', authMentor, logoutAllMentorSessions);

export default mentorAuthRouter;
