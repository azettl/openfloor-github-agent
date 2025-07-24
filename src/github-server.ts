// github-server.ts
import express, { Request, Response, NextFunction } from 'express';
import { createGitHubAgent } from './github-agent';
import { 
  validateAndParsePayload
} from '@openfloor/protocol';

const app = express();
app.use(express.json());

// CORS middleware
const allowedOrigin = 'https://openfloor.dev';
app.use((req, res, next) => {
  if (req.headers.origin === allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Create the GitHub research agent instance
const githubAgent = createGitHubAgent({
  speakerUri: 'tag:openfloor-research.com,2025:github-agent',
  serviceUrl: process.env.SERVICE_URL || 'http://localhost:8080',
  name: 'GitHub Technology Analyst',
  organization: 'OpenFloor Demo Corp'
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    agent: 'github-technology-agent',
    capabilities: ['technology trends', 'github analysis', 'development metrics'],
    timestamp: new Date().toISOString()
  });
});

// Main OpenFloor Protocol endpoint
app.post('/', async (req: Request, res: Response) => {
  try {
    console.log('GitHub Agent - Received request:', JSON.stringify(req.body, null, 2));

    // Validate and parse the incoming payload
    const validationResult = validateAndParsePayload(JSON.stringify(req.body));
    
    if (!validationResult.valid) {
      console.error('Validation errors:', validationResult.errors);
      return res.status(400).json({
        error: 'Invalid OpenFloor payload',
        details: validationResult.errors
      });
    }

    const payload = validationResult.payload!;
    const inEnvelope = payload.openFloor;

    console.log('Processing technology research from:', inEnvelope.sender.speakerUri);

    // Process the envelope through the GitHub agent
    const outEnvelope = await githubAgent.processEnvelope(inEnvelope);

    // Create response payload
    const responsePayload = outEnvelope.toPayload();
    const response = responsePayload.toObject();

    console.log('Sending technology analysis:', JSON.stringify(response, null, 2));

    res.json(response);

  } catch (error) {
    console.error('Error processing technology request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

export default app;