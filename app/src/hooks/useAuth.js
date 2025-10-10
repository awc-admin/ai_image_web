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
          // Production: BYPASS AUTHENTICATION FOR TESTING
          console.log('🔍 AUTH DEBUG - BYPASSING AUTHENTICATION FOR TESTING');
          
          // Create a fake user for testing
          const fakeUser = {
            identityProvider: "bypass",
            userId: "test-user-12345", 
            userDetails: "Test User (Authentication Bypassed)",
            userRoles: ["authenticated", "user"]
          };
          
          console.log('🔍 AUTH DEBUG - Using fake user for testing:', fakeUser);
          setIsAuthenticated(true);
          setUser(fakeUser);
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
