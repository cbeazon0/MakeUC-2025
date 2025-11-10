import { io } from "socket.io-client";

// Initialize and export the socket connection
export const socket = io("/", { transports: ["websocket", "polling"] });

// Dev stuff
// export const socket = io("http://localhost:8000", { autoConnect: true });