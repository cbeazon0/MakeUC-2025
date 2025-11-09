import { io } from "socket.io-client";

// Initialize and export the socket connection
export const socket = io("http://149.28.114.128:8000", { autoConnect: true });
