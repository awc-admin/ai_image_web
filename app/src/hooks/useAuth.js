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
        // Determine if we're in local development or production
        const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // DEBUG: Log environment info
        console.log('🔍 AUTH DEBUG - Environment:', {
          hostname: window.location.hostname,
          isLocalDevelopment,
          currentUrl: window.location.href
        });
        
        if (isLocalDevelopment) {
          // Local development: use mock authentication
          const mockAuthStatus = localStorage.getItem('mockAuthStatus');
          console.log('🔍 AUTH DEBUG - Mock auth status:', mockAuthStatus);
          
          if (mockAuthStatus === 'authenticated') {
            const response = await fetch('/.auth/me');
            const data = await response.json();
            console.log('🔍 AUTH DEBUG - Mock auth response:', data);
            
            if (data && data.clientPrincipal) {
              setIsAuthenticated(true);
              setUser(data.clientPrincipal);
            }
          } else {
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          // Production: use real Azure Static Web Apps authentication
          console.log('🔍 AUTH DEBUG - Fetching /.auth/me...');
          const response = await fetch('/.auth/me');
          console.log('🔍 AUTH DEBUG - Response status:', response.status);
          console.log('🔍 AUTH DEBUG - Response headers:', Object.fromEntries(response.headers.entries()));
          
          const data = await response.json();
          console.log('🔍 AUTH DEBUG - Auth response data:', data);
          
          // Check if user data exists and has a clientPrincipal
          if (data && data.clientPrincipal) {
            console.log('🔍 AUTH DEBUG - User authenticated:', data.clientPrincipal);
            setIsAuthenticated(true);
            setUser(data.clientPrincipal);
          } else {
            console.log('🔍 AUTH DEBUG - User not authenticated');
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('🔍 AUTH DEBUG - Error fetching user data:', error);
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
