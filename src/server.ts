import app from "./app";
import { env } from "./config";

import { prisma } from "./lib/prisma";

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();

    console.log("Database connected successfully");

    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    await prisma.$disconnect();

    process.exit(1);
  }
};

startServer();