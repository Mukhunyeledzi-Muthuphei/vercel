import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  
    // Send query to n8n
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!n8nResponse.ok) {
      throw new Error(`n8n request failed: ${n8nResponse.statusText}`);
    }

    const n8nData = await n8nResponse.json();

    // Return the data from n8n (should contain endpointId, openApiSpec, etc.)
    return NextResponse.json(n8nData);

  } catch (error) {
    console.error('Error submitting query:', error);
    return NextResponse.json(
      { error: 'Failed to submit query' },
      { status: 500 }
    );
  }
}
