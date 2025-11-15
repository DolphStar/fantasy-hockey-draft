// Vercel serverless function to proxy NHL schedule API
// This avoids CORS issues when fetching from the browser

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
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

    // Set CORS headers to allow requests from your domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300'); // Cache for 5 minutes

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching NHL schedule:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch NHL schedule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
