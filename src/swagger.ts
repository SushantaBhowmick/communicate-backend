import swaggerJsDoc from "swagger-jsdoc";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API",
      version: "1.0.0",
      description: "API documentation for my backend",
    },
    servers: [
      {
        url: "http://localhost:4000", // Change for production
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to your route files
};

// ✅ FIX: Pass `swaggerOptions` directly
export const swaggerSpec = swaggerJsDoc(swaggerOptions);
