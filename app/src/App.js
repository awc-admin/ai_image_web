import './App.css';
import Authentication from './components/Authentication';
import './components/Authentication.css';

function App() {
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
      </header>
    </div>
  );
}

export default App;
