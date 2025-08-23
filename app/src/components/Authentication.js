import React from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Authentication component that displays login/logout buttons based on authentication state
 */
const Authentication = () => {
  const { isAuthenticated, user, loading, login, logout } = useAuth();

  if (loading) {
    return <div>Loading authentication status...</div>;
  }

  return (
    <div className="auth-container">
      {isAuthenticated ? (
        <div className="auth-profile">
          <div className="user-info">
            <h3>Welcome, {user.userDetails}!</h3>
            <p>User ID: {user.userId}</p>
            <p>Identity Provider: {user.identityProvider}</p>
          </div>
          <button
            className="auth-button logout-button"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="auth-login">
          <p>Please log in to access the application.</p>
          <button
            className="auth-button login-button"
            onClick={() => login()}
          >
            Login with Azure AD
          </button>
        </div>
      )}
    </div>
  );
};

export default Authentication;
