const BACKEND_PORT = process.env.REACT_APP_API_PORT || "3001";

export const getAPI_URL = () => {
  const override = typeof window !== "undefined" ? localStorage.getItem("apiUrl") : null;
  if (override) return override.replace(/\/$/, "");
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  if (host.includes("vercel.app")) {
    return "https://hotel-pos-txtn.onrender.com";
  }
  return `${protocol}//${host}:${BACKEND_PORT}`;
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
