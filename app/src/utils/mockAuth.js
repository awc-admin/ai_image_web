/**
 * Mock Authentication Utility
 * 
 * This file provides utility functions to simulate Azure Static Web Apps authentication
 * in a local development environment.
 */

// Mock user data - this simulates what Azure Static Web Apps would provide
const mockUserData = {
  identityProvider: "aad",
  userId: "john.doe@contoso.com",
  userDetails: "john.doe@contoso.com", // This is the user's email in Azure AD
  userRoles: ["authenticated"],
  claims: [
    { typ: "name", val: "John Doe" },
    { typ: "emails", val: "john.doe@contoso.com" },
    { typ: "preferred_username", val: "john.doe@contoso.com" }
  ]
};

/**
 * Add mock authentication headers to fetch requests
 * This function wraps the global fetch API to automatically add the required headers
 */
export const setupMockAuth = () => {
  // Store the original fetch function
  const originalFetch = window.fetch;
  
  // Override the global fetch function
  window.fetch = async (url, options = {}) => {
    // Skip mocking /.auth endpoints which are handled separately
    if (url === '/.auth/me') {
      return originalFetch(url, options);
    }
    
    // Create new options object with the original options
    const newOptions = { ...options };
    
    // Initialize headers if they don't exist
    if (!newOptions.headers) {
      newOptions.headers = {};
    }
    
    // If headers is a Headers object, convert to plain object
    if (newOptions.headers instanceof Headers) {
      const plainHeaders = {};
      newOptions.headers.forEach((value, key) => {
        plainHeaders[key] = value;
      });
      newOptions.headers = plainHeaders;
    }
    
    // Add the mock authentication header
    newOptions.headers['x-ms-client-principal'] = JSON.stringify(mockUserData);
    
    // Call the original fetch with the new options
    return originalFetch(url, newOptions);
  };
};

/**
 * Get the current mock user
 * This simulates the /.auth/me endpoint in Azure Static Web Apps
 */
export const getMockUser = () => {
  return {
    clientPrincipal: mockUserData
  };
};

/**
 * Get the current user's email address
 * This utility function extracts the email from the user data
 */
export const getUserEmail = async () => {
  try {
    // In a real environment, we'd call /.auth/me
    // Here we're just returning the mock data
    const userData = getMockUser();
    return userData.clientPrincipal.userDetails || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
};
