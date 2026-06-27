import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const emptyUser = () => ({
  token: null,
  username: null,
  id: null,
  role: null,
  role_label: null,
  modules: [],
  is_admin: false,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await authAPI.me();
      const me = res.data;
      setUser({
        token: localStorage.getItem('access_token'),
        username: me.username,
        id: me.id,
        role: me.role,
        role_id: me.role_id,
        role_label: me.role_label,
        modules: me.modules || [],
        is_admin: me.is_admin,
        email: me.email,
        first_name: me.first_name,
        last_name: me.last_name,
      });
      localStorage.setItem('username', me.username);
      localStorage.setItem('user_role', me.role);
      return me;
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('username');
      localStorage.removeItem('user_role');
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetchMe();
      }
      setLoading(false);
    })();
  }, [fetchMe]);

  const login = async (username, password) => {
    try {
      const response = await authAPI.login({ username, password });
      const { access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('username', username);

      const me = await fetchMe();
      return { success: true, user: me };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_role');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    refreshUser: fetchMe,
    isAuthenticated: !!user?.token,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
