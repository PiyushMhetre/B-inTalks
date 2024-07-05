import express from "express";
import dotenv from 'dotenv'
import cors from 'cors'
import { dbconnect } from "./config/dbconnect.js";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { User } from "./model/User.js";
const  app = express();


app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow these methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  credentials: true // Allow cookies to be sent cross-origin
}));


app.use(cookieParser());
app.use(express.json());
dbconnect();
dotenv.config();


app.use("/api/v1", router);

const server = app.listen(4000, () =>{
    console.log("Server Started ")
})


function parseCookie(cookieHeader) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  const parsedCookies = {};

  cookies.forEach(cookie => {
    const parts = cookie.split('=');
    const key = parts[0].trim();
    const value = parts[1].trim();
    parsedCookies[key] = value;
  });

  return parsedCookies;
}
const wss = new WebSocketServer({server})
const clients = {};
wss.on('connection', (ws, req) => {
  const cookieHeader = req.headers.cookie;
  const token = parseCookie(cookieHeader)?.token;
  // Verify the token and extract userId
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      if (userId) {
        clients[userId] = ws;

        ws.on('close', () => {
          delete clients[userId];
        });

        ws.on('error', (err) => {
          console.error(`WebSocket error for user ${userId}:`, err);
        });

        ws.send(JSON.stringify({ message: 'WebSocket connection established' }));
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      ws.close(4001, 'Invalid token');
    }
  } else {
    console.error('Token not provided');
    ws.close(4000, 'Token not provided');
  }
});
export const sendNotification = async (userId, notification) => {
  const user = await User.findById(userId);
  user.notifications.push(notification);
  await user.save()
  if (clients[userId]) {
     clients[userId].send(JSON.stringify(notification));
  }
};

export const sendPostnotification = async (userId, notification) => {
  try {
    // Find the user by userId
    const user = await User.findById(userId);

    // Check if the user exists and if they have enabled notifications for this type
    if (user) {
      user.notifications.push(notification);
      await user.save();

      // Send notification via WebSocket if client connection exists
      if (clients[userId]) {
        clients[userId].send(JSON.stringify(notification));
      }
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
