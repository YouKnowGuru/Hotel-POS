const BACKEND_PORT = process.env.REACT_APP_API_PORT || "3001";
export const getAPI_URL = () => {
 if (typeof window !== "undefined") {
 const host = window.location.hostname;
 const isDevHost = host === "localhost" || host === "127.0.0.1";
 // SECURITY: the manual `apiUrl` override used to apply EVERYWHERE, so
 // tampering with localStorage on a shared/kiosk computer silently
 // redirected all staff logins and orders to an attacker's server.
 // It stays a local-dev convenience only; production builds always
 // talk to the configured env URL or same origin.
 if (isDevHost) {
 const override = localStorage.getItem("apiUrl");
 if (override) return override.replace(/\/$/, "");
 }
 const envUrl = process.env.REACT_APP_API_URL;
 if (envUrl) return envUrl.replace(/\/$/, "");
 if (isDevHost) {
 return `${window.location.protocol}//${host}:${BACKEND_PORT}`;
 }
 // ── FIX: In production without REACT_APP_API_URL set, the old code
 //    fell back to window.location.origin — the frontend's own URL.
 //    On Vercel (with a catch-all rewrite to /index.html), this caused
 //    /api/menu to return HTML instead of JSON, silently breaking the
 //    menu on all devices. We now log a loud warning so the developer
 //    knows to set REACT_APP_API_URL in the Vercel build environment.
 //    We still return window.location.origin as the last resort
 //    (works when frontend + backend are served from the same origin).
 console.warn(
 "[API] REACT_APP_API_URL is not set. Falling back to window.location.origin (" +
 window.location.origin + "). If the backend is on a separate host " +
 "(e.g. Render), set REACT_APP_API_URL in your build environment."
 );
 return window.location.origin;
 }
 return "";
};

export const getSocketUrl = () => getAPI_URL();

const handleUnauthorized = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
};

export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem("token");

  return fetch(`${getAPI_URL()}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: "include",
  }).then((response) => {
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired. Please login again.");
    }
    return response;
  });
};

export const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${getAPI_URL()}${url}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Expected JSON but got:", text.substring(0, 200));
      throw new Error(
        "Invalid response format: Expected JSON but received HTML or text"
      );
    }

    const data = await response.json();
    if (!Array.isArray(data) && typeof data !== "object") {
      throw new Error("Invalid response format");
    }
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export default getAPI_URL;
