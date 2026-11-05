/**
 * Dynamic API and WebSocket endpoint resolver for RecoverPay.
 * Auto-detects whether running locally or on production (Render, custom domain),
 * preventing hardcoded placeholder URLs and CORS issues.
 */
export const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.includes("your-render-service-name")) {
    return envUrl;
  }
  if (typeof window !== "undefined") {
    // If running in browser on production (e.g. recoverpay-api.onrender.com), use current origin
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return window.location.origin;
    }
  }
  return "http://127.0.0.1:8000";
};

export const API_BASE = getApiBase();

export const getWsUrl = () => {
  const base = getApiBase();
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/ws`;
};

export const WS_URL = getWsUrl();
