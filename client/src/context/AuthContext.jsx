import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.me();
      setUser(data.user);
      setCompany(data.company);
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('company');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setCompany(data.company);
    return data;
  };

  const signup = async (formData) => {
    const { data } = await authAPI.signup(formData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setCompany(data.company);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider value={{ user, company, loading, login, signup, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
