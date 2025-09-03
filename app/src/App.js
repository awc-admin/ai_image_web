import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Authentication from './components/Authentication';
import JobForm from './components/JobForm';
import JobStatusPage from './components/JobStatusPage';
import { useAuth } from './hooks/useAuth';
import './components/Authentication.css';

function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Router>
      <div className="App">
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
              <Link to="/" className="nav-link">Create Job</Link>
              <Link to="/status" className="nav-link">View Job Status</Link>
            </nav>
          )}
          
          {/* Routes for different pages */}
          {isAuthenticated && !loading && (
            <Routes>
              <Route path="/status" element={<JobStatusPage />} />
              <Route path="/" element={
                <div className="job-form-wrapper">
                  <JobForm />
                </div>
              } />
            </Routes>
          )}
        </header>
      </div>
    </Router>
  );
}

export default App;
