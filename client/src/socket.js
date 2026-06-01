import { io } from "socket.io-client";

// Strip /api suffix — Socket.IO connects to the root, not /api
const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/api\/?$/, "");

const socket = io(BASE_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  autoConnect: true,
});

export default socket;