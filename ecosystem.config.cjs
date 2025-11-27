module.exports = {
  apps: [
    {
      name: "tendermatch",
      script: "dist/index.js",
      watch: false,
      env_production: {
        NODE_ENV: "development",
        PORT: 9122
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s"
    }
  ]
};
