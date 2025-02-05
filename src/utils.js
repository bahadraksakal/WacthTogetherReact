const isDevelopment = import.meta.env.VITE_NODE_ENV === "development";

export const url = isDevelopment
  ? import.meta.env.VITE_API_URL_DEVELOPMENT
  : import.meta.env.VITE_API_URL_PRODUCTION;

export const socketOptions = {
  transports: ["websocket", "polling"],
  secure: true,
  rejectUnauthorized: false,
  path: "/socket.io",
  reconnection: true,
  reconnectionAttempts: parseInt(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS),
  reconnectionDelay: parseInt(import.meta.env.VITE_WS_RECONNECT_DELAY),
  reconnectionDelayMax: parseInt(import.meta.env.VITE_WS_RECONNECT_DELAY_MAX),
  timeout: parseInt(import.meta.env.VITE_WS_TIMEOUT),
};

export const appConfig = {
  maxFileSize: import.meta.env.VITE_MAX_FILE_SIZE,
  maxUsers: parseInt(import.meta.env.VITE_MAX_USERS),
  autoDisconnectTimeout: parseInt(import.meta.env.VITE_AUTO_DISCONNECT_TIMEOUT),
};
