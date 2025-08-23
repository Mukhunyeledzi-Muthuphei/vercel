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
function executeCode(code, requestData) {
  try {
    // Create a safe execution context
    const context = {
      request: requestData,
      response: {},
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

    // Create a function from the code
    const functionBody = `
      return (function(context) {
        const { request, response, console, Date, Math, JSON, Array, Object, String, Number, Boolean } = context;
        
        // Add json method to response object
        response.json = (data) => {
          response.body = data;
          response.status = 200;
          response.headers = { 'Content-Type': 'application/json' };
        };
        
        // Add status method to response object
        response.status = (code) => {
          response.status = code;
          return response;
        };
        
        // Add send method to response object
        response.send = (data) => {
          response.body = data;
          if (!response.status) response.status = 200;
        };
        
        console.log('[DEBUG] Executing code:', \`${code}\`);
        ${code}
        console.log('[DEBUG] Response object after execution:', response);
        return response;
      })(context);
    `;

    const result = new Function('context', functionBody)(context);
    return result;
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
    const result = executeCode(endpoint.code, requestData);

    // Handle the response
    if (result && typeof result === 'object') {
      const { status = 200, headers = {}, body } = result;
      
      const response = NextResponse.json(body || result, { status });
      
      // Set custom headers
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
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
