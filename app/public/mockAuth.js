// Mock authentication script for local development
window.mockAuth = {
  // Initialize mock auth
  init: function() {
    console.log('Mock Auth: Initializing');
    
    // Intercept fetch calls to auth endpoints
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      // Handle /.auth/me endpoint
      if (url.includes('/.auth/me')) {
        console.log('Mock Auth: Intercepted /.auth/me request');
        return mockAuth.getMockUserData();
      }
      
      // Pass through all other requests
      return originalFetch(url, options);
    };
    
    // Add event listener for auth route changes
    window.addEventListener('popstate', this.handleRouteChange);
    
    // Check if we need to handle any auth routes on initial load
    this.handleRouteChange();
  },
  
  // Handle route changes for auth endpoints
  handleRouteChange: function() {
    const currentPath = window.location.pathname;
    
    // Handle login route
    if (currentPath === '/.auth/login/aad') {
      console.log('Mock Auth: Handling login route');
      mockAuth.simulateLogin();
      return;
    }
    
    // Handle logout route
    if (currentPath === '/.auth/logout') {
      console.log('Mock Auth: Handling logout route');
      mockAuth.simulateLogout();
      return;
    }
  },
  
  // Simulate login process
  simulateLogin: function() {
    console.log('Mock Auth: Simulating login');
    localStorage.setItem('mockAuthStatus', 'authenticated');
    
    // Redirect back to the main page
    window.location.href = '/';
  },
  
  // Simulate logout process
  simulateLogout: function() {
    console.log('Mock Auth: Simulating logout');
    localStorage.removeItem('mockAuthStatus');
    
    // Get the redirect URL from query params or default to home
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('post_logout_redirect_uri') || '/';
    
    // Redirect to the specified URL
    window.location.href = redirectUrl;
  },
  
  // Get mock user data
  getMockUserData: function() {
    const isAuthenticated = localStorage.getItem('mockAuthStatus') === 'authenticated';
    
    if (isAuthenticated) {
      return Promise.resolve({
        json: () => Promise.resolve({
          clientPrincipal: {
            identityProvider: "aad",
            userId: "mock-user-id-12345",
            userDetails: "John Doe",
            userRoles: ["authenticated", "user"]
          }
        })
      });
    } else {
      return Promise.resolve({
        json: () => Promise.resolve({})
      });
    }
  }
};

// Initialize mock auth when script is loaded (only in local development)
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize mock auth in local development
  const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalDevelopment) {
    console.log('Mock Auth: Initializing for local development');
    window.mockAuth.init();
  } else {
    console.log('Mock Auth: Skipping initialization in production environment');
  }
});
