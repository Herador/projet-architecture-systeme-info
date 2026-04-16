import { createContext, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:3000";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const interceptorRef = useRef(null);

  function _clearSession() {
    localStorage.removeItem("token");
    setUser(null);
  }

  // Global 401 interceptor — fires on any axios response with status 401
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
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API_URL}/auth/getInfo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => _clearSession())
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem("token", token);
    setUser(userData);
  }

  function logout() {
    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_URL}/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .finally(() => _clearSession());
  }

  async function becomeOwner() {
    const token = localStorage.getItem("token");
    await axios.post(
      `${API_URL}/auth/become-owner`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { data } = await axios.get(`${API_URL}/auth/getInfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(data);
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
