const http = require("http");
const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const { API_PREFIX } = require("./utils/paths");

(async () => {
  await connectDB();
  const server = http.createServer(app);
  server.listen(env.PORT, () => {
    console.log(`listening http://localhost:${env.PORT}${API_PREFIX}`);
  });

  function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
