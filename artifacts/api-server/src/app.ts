import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Return a readable JSON error when the request body parser rejects an upload.
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (typeof error === "object" && error !== null && "type" in error) {
    const parserError = error as { type?: string };

    if (parserError.type === "entity.too.large") {
      res.status(413).json({
        error: "The upload is too large. Choose a JPEG, PNG, or WebP image up to 3 MB.",
      });
      return;
    }

    if (parserError.type === "entity.parse.failed") {
      res.status(400).json({ error: "The request body must contain valid JSON." });
      return;
    }
  }

  next(error);
});

export default app;
