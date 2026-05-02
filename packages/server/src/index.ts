import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { authTrpcContext } from './trpc';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Serve static files from the React app
// In Docker, we will place the client build at /app/packages/client/dist
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(cookieParser());

app.get('/health', (req: Request, res: Response) => {
  res.json({ message: "Server is Up!" });
});

app.use(
  '/trpc-api',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: authTrpcContext
  })
);

// All other GET requests not handled will return the React app
app.get('*all', (req: Request, res: Response) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});