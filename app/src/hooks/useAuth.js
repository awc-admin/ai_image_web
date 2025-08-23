import { useState, useEffect } from 'react';

/**
 * Custom hook to handle authentication state and user data
 * @returns {Object} Authentication state and user data
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Check if we have a mock auth status (for local development)
        const mockAuthStatus = localStorage.getItem('mockAuthStatus');
        
        if (mockAuthStatus === 'authenticated') {
          // For mock auth in local development
          const response = await fetch('/.auth/me');
          const data = await response.json();
          
          if (data && data.clientPrincipal) {
            setIsAuthenticated(true);
            setUser(data.clientPrincipal);
          }
        } else {
          // If no mock auth status and no real auth, check real auth status
          const response = await fetch('/.auth/me');
          const data = await response.json();
          
          // Check if user data exists and has a clientPrincipal
          if (data && data.clientPrincipal) {
            setIsAuthenticated(true);
            setUser(data.clientPrincipal);
          } else {
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  /**
   * Function to handle user login with Azure AD
   */
  const login = () => {
    // Redirect to Azure AD login page
    window.location.href = '/.auth/login/aad';
  };

  /**
   * Function to handle user logout
   * @param {string} postLogoutRedirectUri - The URI to redirect to after logout (optional)
   */
  const logout = (postLogoutRedirectUri = window.location.origin) => {
    // Redirect to logout endpoint with post-logout redirect URI
    window.location.href = `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
  };

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout
  };
}
