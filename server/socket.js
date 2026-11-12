import { Server } from 'socket.io';
import userModel from './src/models/user.model.js';
import MentorModel from './src/models/mentor.model.js';

let io;

export function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: [ 'GET', 'POST' ]
        }
    });

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        socket.on('join', async (data) => {
            const { userId, userType } = data;

            if (userType === 'user') {
                await userModel.findByIdAndUpdate(userId, { socketId: socket.id });
            } else if (userType === 'mentor') {
                await MentorModel.findByIdAndUpdate(userId, { socketId: socket.id });
            }
        });
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });
}

export function notifyMentorRegistration() {
    io?.emit('mentor:registered');
}