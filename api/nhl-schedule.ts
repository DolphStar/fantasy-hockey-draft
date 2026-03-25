// Vercel serverless function to proxy NHL schedule API
// This avoids CORS issues when fetching from the browser

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPublicCorsHeaders } from './_lib/routeAccess';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const corsHeaders = getPublicCorsHeaders(req.headers.origin);
  for (const [header, value] of Object.entries(corsHeaders)) {
    res.setHeader(header, value);
  }
  res.setHeader('Cache-Control', 's-maxage=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch from NHL API
    const response = await fetch('https://api-web.nhle.com/v1/schedule/now');
    
    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching NHL schedule:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch NHL schedule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
