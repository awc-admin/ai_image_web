const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');

module.exports = function(app) {
  console.log('Setting up Flask server proxy middleware...');
  
  // Parse JSON bodies for API requests - IMPORTANT for POST requests to work properly
  app.use('/api-proxy', bodyParser.json());
  
  // Proxy API requests to the Flask server
  app.use(
    '/api-proxy',
    createProxyMiddleware({
      target: 'http://20.11.8.84:5000',
      changeOrigin: true,
      pathRewrite: {
        '^/api-proxy': '', // remove the /api-proxy path
      },
      // Add logging for debugging
      logLevel: 'debug',
      // Enable all HTTP methods including POST
      onProxyReq: (proxyReq, req, res) => {
        // Log outgoing request
        console.log(`Proxying ${req.method} request to: ${req.originalUrl}`);
        
        // If it's a POST with a body, make sure it's properly handled
        if (req.method === 'POST' && req.body) {
          const bodyData = JSON.stringify(req.body);
          // Update header
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          // Write body data to the proxyReq stream
          proxyReq.write(bodyData);
        }
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ 
          error: 'Proxy error connecting to Flask server',
          details: err.message 
        }));
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log the response status
        console.log(`Received response: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
        
        // Add CORS headers to the response
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      }
    })
  );

  console.log('Flask server proxy middleware set up successfully.');
};
