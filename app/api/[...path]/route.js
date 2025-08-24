import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'thups';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'something';

let client = null;

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client;
}

async function getEndpointFromDB(endpointId) {
  const client = await connectToMongo();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);
  
  
  // First, let's see what's in the collection
  const allDocs = await collection.find({}).toArray();
  
  // Try to find the specific endpoint - convert string ID to ObjectId
  const endpoint = await collection.findOne({ _id: new ObjectId(endpointId) });
  
  return endpoint;
}

// Safe code execution function
async function executeCode(code, requestData) {
  try {
    // Create a safe execution context
    const context = {
      request: {
        ...requestData,
        method: requestData.method // Ensure method is accessible as request.method
      },
      response: {
        statusCode: 200,
        body: null,
        headers: {},
        ended: false,
        
        // Add json method to response object
        json: function(data) {
          this.body = data;
          this.headers['Content-Type'] = 'application/json';
          this.ended = true;
          return this;
        },
        
        // Add status method to response object
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        
        // Add send method to response object
        send: function(data) {
          this.body = data;
          this.ended = true;
          return this;
        },
        
        // Add end method to response object
        end: function() {
          this.ended = true;
          return this;
        }
      },
      console: {
        log: (...args) => console.log('[Endpoint Execution]:', ...args),
        error: (...args) => console.error('[Endpoint Execution]:', ...args),
      },
      // Add any other safe globals you want to expose
      Date,
      Math,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
    };

          console.log('[DEBUG] Executing code:', code);
      console.log('[DEBUG] Request body available as request.body:', requestData.body);
    
    try {
      // Clean and prepare the code for execution
      const cleanCode = code.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
      
      // Execute the code in an async context
      const functionBody = `
        (async function() {
          const { request, response, console, Date, Math, JSON, Array, Object, String, Number, Boolean } = context;
          ${cleanCode}
        })()
      `;
      const result = await eval(functionBody);
      
      // If the code returned something and response hasn't been ended, use it
      if (result !== undefined && !context.response.ended) {
        context.response.body = result;
      }
      
      console.log('[DEBUG] Response object after execution:', context.response);
      
      // Validate that the response object is properly configured
      if (!context.response || typeof context.response !== 'object') {
        throw new Error('Response object is not properly initialized');
      }
      
      if (context.response.statusCode === undefined) {
        context.response.statusCode = 200; // Set default status if not set
      }
      
      return context.response;
    } catch (error) {
      console.error('[DEBUG] Error in injected code:', error);
      context.response.statusCode = 500;
      context.response.body = { error: 'Internal server error', details: error.message };
      return context.response;
    }
  } catch (error) {
    console.error('Code execution error:', error);
    throw new Error(`Code execution failed: ${error.message}`);
  }
}

export async function GET(request, { params }) {
  return handleRequest(request, params, 'GET');
}

export async function POST(request, { params }) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(request, { params }) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(request, { params }) {
  return handleRequest(request, params, 'DELETE');
}

export async function PATCH(request, { params }) {
  return handleRequest(request, params, 'PATCH');
}

async function handleRequest(request, params, method) {
  try {
    
    // In Next.js 15, params needs to be awaited
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path;
    
    const endpointId = pathSegments[0]; // First segment is the endpoint ID

    if (!endpointId) {
      console.log('❌ [DEBUG] No endpoint ID found');
      return NextResponse.json(
        { error: 'Endpoint ID is required' },
        { status: 400 }
      );
    }
    
    // Get endpoint data from MongoDB
    const endpoint = await getEndpointFromDB(endpointId);
    console.log('🔍 [DEBUG] MongoDB query result:', endpoint ? 'Found' : 'Not found');
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint not found' },
        { status: 404 }
      );
    }

    // Prepare request data
    const url = new URL(request.url);
    const requestData = {
      method,
      url: request.url,
      path: pathSegments,
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries()),
      body: null,
    };

    // Parse body for non-GET requests
    if (method !== 'GET') {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          requestData.body = await request.json();
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
          const formData = await request.formData();
          requestData.body = Object.fromEntries(formData.entries());
        } else {
          requestData.body = await request.text();
        }
      } catch (error) {
        console.warn('Failed to parse request body:', error);
      }
    }
    
    // Execute the endpoint code
    const result = await executeCode(endpoint.code, requestData);

    // Handle the response
    if (result && typeof result === 'object' && result.statusCode !== undefined) {
      const status = result.statusCode || 200;
      const headers = result.headers || {};
      const body = result.body || result;
      
      // For 204 No Content, don't send a body (ignore any body that was set)
      if (status === 204) {
        const response = new NextResponse(null, { status });
        
        // Set custom headers
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
        return response;
      }
      
      // If response was ended but no body was set, return empty response
      if (result.ended && body === null) {
        const response = new NextResponse(null, { status });
        
        // Set custom headers
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
        return response;
      }
      
      const response = NextResponse.json(body, { status });
      
      // Set custom headers
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }

    // If response object is not properly set, treat as error
    if (!result || typeof result !== 'object' || result.statusCode === undefined) {
      console.error('[DEBUG] Invalid response object:', result);
      return NextResponse.json(
        { error: 'Invalid response from endpoint', details: 'Response object was not properly configured' },
        { status: 500 }
      );
    }

    // Default response
    return NextResponse.json(result || { message: 'Endpoint executed successfully' });

  } catch (error) {
    console.error('❌ [DEBUG] Endpoint execution error:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
