// config-overrides.js
module.exports = function override(config, env) {
  // Add custom webpack configuration
  if (config.devServer) {
    config.devServer.allowedHosts = 'all';
  }
  return config;
};