import { Router } from 'express';
import {
    getMe,
    getUserProfile,
    googleLogin,
    login,
    logout,
    logoutAll,
    refreshToken,
    registerUser,
    toggleActive,
    updateProfilePicture,
    updateUserProfile,
    createWalletTopupOrder,
    verifyWalletTopup,
    verifyEmail
} from '../controllers/authUser.controller.js';
import { authUser } from '../middleware/authMiddleware.js';
import { uploadChatImage, uploadUserProfilePicture } from '../middleware/multer.middleware.js';
import {
    listAppointmentMessages,
    createAppointment,
    getAppointmentVideoCall,
    respondToAppointmentVideoCall,
    endAppointmentVideoCall,
    createAppointmentVideoCallToken,
    listApprovedMentors,
    listUserAppointments,
    payForAppointment,
    sendAppointmentMessage
} from '../controllers/appointment.controller.js';

const authRouter = Router();

authRouter.post('/register', uploadUserProfilePicture, registerUser);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.get('/me', authUser ,getMe);
authRouter.get('/mentors', authUser, listApprovedMentors);
authRouter.get('/appointments', authUser, listUserAppointments);
authRouter.post('/appointments', authUser, createAppointment);
authRouter.post('/appointments/:appointmentId/pay', authUser, payForAppointment);
authRouter.get('/appointments/:appointmentId/messages', authUser, listAppointmentMessages);
authRouter.post('/appointments/:appointmentId/messages', authUser, uploadChatImage, sendAppointmentMessage);
authRouter.get('/appointments/:appointmentId/call', authUser, getAppointmentVideoCall);
authRouter.patch('/appointments/:appointmentId/call/:callId', authUser, respondToAppointmentVideoCall);
authRouter.post('/appointments/:appointmentId/call/:callId/token', authUser, createAppointmentVideoCallToken);
authRouter.post('/appointments/:appointmentId/call/:callId/end', authUser, endAppointmentVideoCall);
authRouter.get('/profile/:userId', authUser, getUserProfile);
authRouter.put('/profile/:userId', authUser, uploadUserProfilePicture, updateUserProfile);
authRouter.post('/wallet/topup/order', authUser, createWalletTopupOrder);
authRouter.post('/wallet/topup/verify', authUser, verifyWalletTopup);
authRouter.put('/profile-picture', authUser, uploadUserProfilePicture, updateProfilePicture);
authRouter.post('/refresh', refreshToken);
authRouter.post('/logout', authUser ,logout);
authRouter.post('/logout-all', authUser  ,logoutAll);
authRouter.post('/googlelogin', googleLogin);
authRouter.post('/toggle-active', authUser, toggleActive);

export default authRouter;