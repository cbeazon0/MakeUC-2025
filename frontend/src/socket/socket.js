import { io } from "socket.io-client";

// Initialize and export the socket connection
export const socket = io("http://localhost:5000", { autoConnect: true });
