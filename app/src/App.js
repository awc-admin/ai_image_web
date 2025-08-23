import './App.css';
import Authentication from './components/Authentication';
import JobForm from './components/JobForm';
import { useAuth } from './hooks/useAuth';
import './components/Authentication.css';

function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
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
        
        {/* Render JobForm only when user is authenticated */}
        {isAuthenticated && !loading && (
          <div className="job-form-wrapper">
            <JobForm />
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
