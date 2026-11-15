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
    listAppointmentMessages,
    sendAppointmentMessage,
    createAppointmentVideoCall,
    getAppointmentVideoCall,
    endAppointmentVideoCall,
    createAppointmentVideoCallToken,
    updateAppointmentStatus,
    updateMentorSessionFee
} from '../controllers/appointment.controller.js';

const mentorAuthRouter = Router();

mentorAuthRouter.post('/register', uploadMentorDocuments, registerMentor);
mentorAuthRouter.post('/verify-email', verifyMentorEmail);
mentorAuthRouter.post('/login', loginMentor);
mentorAuthRouter.post('/refresh', refreshMentorToken);
mentorAuthRouter.get('/me', authMentor, getMentorMe);
mentorAuthRouter.get('/appointments', authMentor, listMentorAppointments);
mentorAuthRouter.patch('/appointments/:appointmentId', authMentor, updateAppointmentStatus);
mentorAuthRouter.patch('/profile/session-fee', authMentor, updateMentorSessionFee);
mentorAuthRouter.get('/appointments/:appointmentId/messages', authMentor, listAppointmentMessages);
mentorAuthRouter.post('/appointments/:appointmentId/messages', authMentor, sendAppointmentMessage);
mentorAuthRouter.get('/appointments/:appointmentId/call', authMentor, getAppointmentVideoCall);
mentorAuthRouter.post('/appointments/:appointmentId/call', authMentor, createAppointmentVideoCall);
mentorAuthRouter.post('/appointments/:appointmentId/call/:callId/token', authMentor, createAppointmentVideoCallToken);
mentorAuthRouter.post('/appointments/:appointmentId/call/:callId/end', authMentor, endAppointmentVideoCall);
mentorAuthRouter.post('/logout', authMentor, logoutMentor);
mentorAuthRouter.post('/logout-all', authMentor, logoutAllMentorSessions);

export default mentorAuthRouter;
