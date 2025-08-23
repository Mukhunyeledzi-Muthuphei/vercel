import { NextResponse } from 'next/server';

export async function GET(request) {
  // This is an example of what the dynamic endpoint code would look like
  const mockCode = `
    // Set response status
    response.status = 200;
    
    // Set response headers
    response.headers = {
      'Content-Type': 'application/json',
      'X-Generated-By': 'AI Endpoint Generator'
    };
    
    // Set response body
    response.body = {
      message: 'Hello from test endpoint!',
      timestamp: new Date().toISOString(),
      query: request.query,
      method: request.method,
      path: request.path
    };
  `;

  // Simulate the code execution
  const context = {
    request: {
      method: 'GET',
      url: request.url,
      path: ['test-endpoint'],
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(new URL(request.url).searchParams.entries()),
      body: null,
    },
    response: {},
    console: {
      log: (...args) => console.log('[Test Endpoint]:', ...args),
      error: (...args) => console.error('[Test Endpoint]:', ...args),
    },
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
  };

  try {
    const functionBody = `
      return (function(context) {
        const { request, response, console, Date, Math, JSON, Array, Object, String, Number, Boolean } = context;
        ${mockCode}
        return response;
      })(context);
    `;

    const result = new Function('context', functionBody)(context);
    
    const response = NextResponse.json(result.body || result, { status: result.status || 200 });
    
    // Set custom headers
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    
    return response;
  } catch (error) {
    console.error('Test endpoint execution error:', error);
    return NextResponse.json(
      { error: 'Test endpoint execution failed', details: error.message },
      { status: 500 }
    );
  }
}
