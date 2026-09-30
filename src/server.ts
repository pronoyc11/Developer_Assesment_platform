import app from "./app";
import { env } from "./config";
import { prisma } from "./lib/prisma";
import { connectRedis, disconnectRedis } from "./lib/redis";

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");

    try {
      await connectRedis();
    } catch (redisError) {
      console.error("Redis connection error on startup:", redisError);
    }

    const server = app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log("Database disconnected cleanly");
        } catch (dbError) {
          console.error("Error disconnecting database:", dbError);
        }

        try {
          await disconnectRedis();
        } catch (redisError) {
          console.error("Error disconnecting Redis:", redisError);
        }

        process.exit(0);
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error);

    try {
      await prisma.$disconnect();
      await disconnectRedis();
    } catch {
      // Ignore cleanup error on critical failure
    }

    process.exit(1);
  }
};

startServer();
