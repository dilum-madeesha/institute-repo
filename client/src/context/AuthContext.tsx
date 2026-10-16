import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import * as apiService from '../api';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readSavedUser = (): User | null => {
  const saved = localStorage.getItem('user');
  if (!saved) return null;

  try {
    const parsed: Partial<User> | null = JSON.parse(saved);
    const role = typeof parsed?.role === 'string' ? parsed.role.trim().toUpperCase() : '';
    const status = typeof parsed?.status === 'string' ? parsed.status.trim().toUpperCase() : '';
    const validRoles: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.fullName !== 'string' ||
      typeof parsed.email !== 'string' ||
      !validRoles.includes(role as UserRole) ||
      (status !== 'ACTIVE' && status !== 'INACTIVE')
    ) {
      localStorage.removeItem('user');
      return null;
    }
    const normalizedUser = { ...parsed, role: role as UserRole, status } as User;
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    return normalizedUser;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(readSavedUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await apiService.getCurrentUser();
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403) {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } else {
        console.error('Failed to refresh the authenticated user:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiService.signIn(email, password);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiService.signOut();
    } catch (err) {
      console.warn('Logout endpoint error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAdmin,
        isTeacher,
        isStudent,
        isParent,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
