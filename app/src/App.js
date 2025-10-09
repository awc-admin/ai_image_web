import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import Authentication from './components/Authentication';
import JobForm from './components/JobForm';
import JobStatusPage from './components/JobStatusPage';
import ModifyJobForm from './components/ModifyJobForm';
import DebugInfo from './components/DebugInfo';
import { useAuth } from './hooks/useAuth';
import './components/Authentication.css';

// Create an AppContent component to use the useLocation hook
function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  return (
    <div className="App">
      {/* Debug component - remove after debugging */}
      <DebugInfo />
      
      <header className="App-header">
        <h1>AI Image Web App</h1>
        <p>
          Azure Static Web App with React and Python API
        </p>
        {/* Wrap Authentication in a div to isolate it from App-header styles */}
        <div className="auth-wrapper">
          <Authentication />
        </div>
        
        {/* Navigation links - only show when authenticated */}
        {isAuthenticated && !loading && (
          <nav className="main-nav">
            {location.pathname !== '/' && (
              <Link to="/" className="nav-link">Create Job</Link>
            )}
            <Link to="/status" className="nav-link">View Job Status</Link>
          </nav>
        )}
        
        {/* Routes for different pages */}
        {isAuthenticated && !loading && (
          <Routes>
            <Route path="/status" element={<JobStatusPage />} />
            <Route path="/modify-job" element={<ModifyJobForm />} />
            <Route path="/" element={
              <div className="job-form-wrapper">
                <JobForm />
              </div>
            } />
          </Routes>
        )}
      </header>
    </div>
  );
}

// Main App component that sets up the router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
