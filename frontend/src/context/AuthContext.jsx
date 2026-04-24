import { createContext, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:3000";

const AuthContext = createContext(null);

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function userFromToken(token) {
  const payload = decodeToken(token);
  if (!payload) return null;
  return {
    id:          payload.user_id,
    username:    payload.username,
    email:       payload.email,
    role:        payload.role,
    is_verified: payload.is_verified,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const interceptorRef = useRef(null);

  function _clearSession() {
    localStorage.removeItem("token");
    setUser(null);
  }

  useEffect(() => {
    interceptorRef.current = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          _clearSession();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptorRef.current);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    const decoded = userFromToken(token);
    if (decoded) {
      setUser(decoded);
    } else {
      _clearSession();
    }
    setLoading(false);
  }, []);

  function login(token) {
    localStorage.setItem("token", token);
    setUser(userFromToken(token));
  }

  function logout() {
    const token = localStorage.getItem("token");
    axios
      .post(`${API_URL}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .finally(() => _clearSession());
  }

  async function becomeOwner() {
    const token = localStorage.getItem("token");
    const { data } = await axios.post(
      `${API_URL}/auth/become-owner`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const newToken = data.token || token;
    if (data.token) localStorage.setItem("token", data.token);
    setUser(userFromToken(newToken));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, becomeOwner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
