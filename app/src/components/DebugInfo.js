import React, { useState, useEffect } from 'react';

const DebugInfo = () => {
  const [debugInfo, setDebugInfo] = useState({});
  const [authProviders, setAuthProviders] = useState({});

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        // Get auth providers info
        const providersResponse = await fetch('/.auth/providers');
        const providersData = await providersResponse.json();
        setAuthProviders(providersData);

        // Get current auth info
        const authResponse = await fetch('/.auth/me');
        const authData = await authResponse.json();

        setDebugInfo({
          hostname: window.location.hostname,
          currentUrl: window.location.href,
          authMeResponse: authData,
          authMeStatus: authResponse.status,
          providersResponse: providersData,
          providersStatus: providersResponse.status
        });

        console.log('🔍 DEBUG INFO - Full debug data:', {
          hostname: window.location.hostname,
          currentUrl: window.location.href,
          authMeResponse: authData,
          authMeStatus: authResponse.status,
          providersResponse: providersData,
          providersStatus: providersResponse.status
        });

      } catch (error) {
        console.error('🔍 DEBUG INFO - Error:', error);
        setDebugInfo({ error: error.message });
      }
    };

    fetchDebugInfo();
  }, []);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: '#f0f0f0', 
      padding: '15px', 
      border: '1px solid #ccc',
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '400px',
      maxHeight: '300px',
      overflow: 'auto',
      zIndex: 9999
    }}>
      <h4>🔍 Debug Info</h4>
      <div><strong>Hostname:</strong> {debugInfo.hostname}</div>
      <div><strong>Auth Status:</strong> {debugInfo.authMeStatus}</div>
      <div><strong>Client Principal:</strong> {debugInfo.authMeResponse?.clientPrincipal ? 'Present' : 'null'}</div>
      <div><strong>Providers Status:</strong> {debugInfo.providersStatus}</div>
      
      <details style={{ marginTop: '10px' }}>
        <summary>Full Auth Response</summary>
        <pre style={{ fontSize: '10px', overflow: 'auto' }}>
          {JSON.stringify(debugInfo.authMeResponse, null, 2)}
        </pre>
      </details>
      
      <details style={{ marginTop: '10px' }}>
        <summary>Providers Response</summary>
        <pre style={{ fontSize: '10px', overflow: 'auto' }}>
          {JSON.stringify(debugInfo.providersResponse, null, 2)}
        </pre>
      </details>

      {debugInfo.error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          <strong>Error:</strong> {debugInfo.error}
        </div>
      )}
    </div>
  );
};

export default DebugInfo;
