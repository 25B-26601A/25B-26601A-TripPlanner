import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.auth.me(); 
        setUser(me.user || me);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const res = await api.auth.login({ email, password });
    setUser(res.user);
    return res;
  };

  const register = async ({ name, email, password }) => {
    const res = await api.auth.register({ name, email, password });
    setUser(res.user);
    return res;
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
