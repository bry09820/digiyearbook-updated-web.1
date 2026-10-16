// src/services/api.js
import axios from "axios";

const RAW_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, "").replace(/\/api$/, "");

const api = axios.create({
  baseURL: `${BASE_URL}/api`,       // /api appended once, here
  withCredentials: true,            // needed for Sanctum CSRF cookie
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request: attach Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("admin_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const url = String(config.url ?? "");
    const method = String(config.method ?? "get").toLowerCase();
    if (method === "get" && (url.includes("/admin/dashboard") || url.includes("/admin/analytics") || url.includes("/admin/notifications"))) {
      config.headers["Cache-Control"] = "no-cache";
      config.headers.Pragma = "no-cache";
      config.params = { ...(config.params ?? {}), _: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response: handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      // Redirect without reload loop only if not already on /login
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    if (status === 403) {
      // Optional: redirect to an unauthorized page
      // window.location.href = "/unauthorized";
      console.warn("Forbidden: insufficient permissions.");
    }

    if (status >= 500) {
      console.error("Server error:", error.response?.data?.message ?? "Unexpected error");
    }

    return Promise.reject(error);
  }
);

export function notifyAdminAccountsChanged() {
  window.dispatchEvent(new CustomEvent("admin-users-changed"));
}

export default api;
