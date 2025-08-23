'use client';

import { useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { parse } from 'yaml';

export default function Home() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiSpec, setApiSpec] = useState(null);
  const [error, setError] = useState(null);

  // Function to generate sample data based on OpenAPI schema
  const generateSampleData = (schema) => {
    if (!schema) return {};

    const { type, properties, items, example } = schema;

    // If there's an example, use it
    if (example !== undefined) {
      return example;
    }

    // Handle different types
    switch (type) {
      case 'string':
        return 'test_string';
      case 'number':
      case 'integer':
        return 42;
      case 'boolean':
        return true;
      case 'array':
        if (items) {
          return [generateSampleData(items)];
        }
        return [];
      case 'object':
        if (properties) {
          const obj = {};
          for (const [key, propSchema] of Object.entries(properties)) {
            obj[key] = generateSampleData(propSchema);
          }
          return obj;
        }
        return {};
      default:
        return {};
    }
  };

  // Function to validate the generated endpoint and OpenAPI spec
  const validateEndpoint = async (data) => {
    try {
      // Check if we have the required data
      if (!data.id || !data.spec) {
        console.log('Missing endpoint ID or spec');
        return false;
      }

      // Parse the OpenAPI spec to understand the endpoint
      let parsedSpec;
      try {
        parsedSpec = JSON.parse(data.spec);
      } catch {
        parsedSpec = parse(data.spec.replace(/\\n/g, '\n'));
      }

      // Find the first available endpoint to test
      const paths = parsedSpec.paths || {};
      const firstPath = Object.keys(paths)[0];
      
      if (!firstPath) {
        console.log('No paths found in OpenAPI spec');
        return false;
      }

      const pathMethods = paths[firstPath];
      const firstMethod = Object.keys(pathMethods)[0];
      
      if (!firstMethod) {
        console.log('No methods found in first path');
        return false;
      }

      const methodInfo = pathMethods[firstMethod];
      const method = firstMethod.toUpperCase();
      
      console.log(`Testing endpoint: ${method} ${firstPath}`);

      // Build the test URL
      const baseUrl = `${window.location.origin}/api/${data.id}`;
      const testUrl = `${baseUrl}${firstPath}`;

      // Prepare request options
      const requestOptions = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const requestBody = methodInfo.requestBody;
        if (requestBody && requestBody.content && requestBody.content['application/json']) {
          // Generate sample data based on the schema
          const schema = requestBody.content['application/json'].schema;
          const sampleData = generateSampleData(schema);
          requestOptions.body = JSON.stringify(sampleData);
        } else {
          // Default empty body for POST/PUT/PATCH without defined schema
          requestOptions.body = JSON.stringify({});
        }
      }

      console.log(`Making request to: ${testUrl}`, requestOptions);
      const response = await fetch(testUrl, requestOptions);

      // Check if endpoint responds (even if it's an error, it should respond)
      if (!response.ok && response.status !== 404) {
        console.log('Endpoint not responding properly');
        return false;
      }

      // Validate OpenAPI spec by trying to parse it
      try {
        let parsedSpec;
        
        // Try parsing as JSON first
        try {
          parsedSpec = JSON.parse(data.spec);
        } catch {
          // If JSON fails, try YAML
          parsedSpec = parse(data.spec.replace(/\\n/g, '\n'));
        }

        // Basic validation - check if it has required fields
        if (!parsedSpec.openapi && !parsedSpec.swagger) {
          console.log('Invalid OpenAPI spec - missing version');
          return false;
        }

        if (!parsedSpec.info || !parsedSpec.paths) {
          console.log('Invalid OpenAPI spec - missing info or paths');
          return false;
        }

        // Test if SwaggerUI can render it by creating a temporary element
        const testDiv = document.createElement('div');
        testDiv.style.display = 'none';
        document.body.appendChild(testDiv);
        
        try {
          // This is a basic test - in a real implementation you might want to use SwaggerUI's validation
          const specString = JSON.stringify(parsedSpec);
          if (specString.length < 100) {
            console.log('OpenAPI spec too short, likely invalid');
            return false;
          }
        } finally {
          document.body.removeChild(testDiv);
        }

        console.log('Endpoint validation passed');
        return true;
      } catch (specError) {
        console.log('OpenAPI spec validation failed:', specError);
        return false;
      }
    } catch (error) {
      console.log('Endpoint validation error:', error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setApiSpec(null);

    const maxRetries = 10; // Maximum number of retries
    const retryDelay = 1000; // Fixed delay in milliseconds between retries
    let attempt = 0;

    const attemptRequest = async () => {
      try {
        const response = await fetch('/api/submit-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim() }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Check if the response contains an error
        if (data.error) {
          throw new Error(data.error);
        }

        // Success! Now validate the endpoint and OpenAPI spec
        const isValid = await validateEndpoint(data);
        if (isValid) {
          setApiSpec(data);
          return true;
        } else {
          // Endpoint validation failed, throw error to trigger retry
          throw new Error('Endpoint validation failed');
        }
      } catch (err) {
        attempt++;
        
        if (attempt >= maxRetries) {
          // Max retries reached, show error
          setError(`Sorry, I'm having trouble processing your request right now. Please try again later.`);
          return false;
        }

        // Show user-friendly retry status
        setError(`Still thinking... (thought ${attempt}/${maxRetries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Recursively try again
        return await attemptRequest();
      }
    };

    await attemptRequest();
    setIsLoading(false);
  };

  const renderApiSpec = (spec, onRetry) => {
    if (!spec) return null;

    // Function to validate and fix OpenAPI spec
    const validateAndFixOpenApiSpec = (specString) => {
      try {
        let parsedSpec;
        
        // Try parsing as JSON first
        try {
          parsedSpec = JSON.parse(specString);
        } catch {
          // If JSON fails, try YAML
          parsedSpec = parse(specString.replace(/\\n/g, '\n'));
        }

        // Ensure the spec has a valid version field
        if (!parsedSpec.openapi && !parsedSpec.swagger) {
          // Add OpenAPI 3.0.0 version if missing
          parsedSpec.openapi = '3.0.0';
        }

        // Ensure basic structure exists
        if (!parsedSpec.info) {
          parsedSpec.info = {
            title: 'Generated API',
            version: '1.0.0',
            description: 'API generated from user description'
          };
        }

        if (!parsedSpec.paths) {
          parsedSpec.paths = {};
        }

        return parsedSpec;
      } catch (error) {
        console.error('Error parsing OpenAPI spec:', error);
        // Trigger retry instead of showing fallback
        if (onRetry) {
          onRetry();
        }
        return null;
      }
    };

    return (
      <div className="w-full max-w-4xl mx-auto mt-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Generated API Endpoint</h3>
          </div>
          
          <div className="p-6 space-y-6">
            {spec.id && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Your API Endpoint URL</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <code className="text-sm font-mono text-blue-900 break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/${spec.id}` : `/api/${spec.id}`}
                  </code>
                  <button
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/api/${spec.id}` : `/api/${spec.id}`;
                      navigator.clipboard.writeText(url);
                      // You could add a toast notification here
                    }}
                    className="ml-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use this URL to make requests to your generated API endpoint
                </p>
              </div>
            )}

            {spec.spec && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-4">OpenAPI Specification</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <SwaggerUI 
                    spec={validateAndFixOpenApiSpec(spec.spec)}
                    docExpansion="list"
                    defaultModelsExpandDepth={1}
                    defaultModelExpandDepth={1}
                    tryItOutEnabled={true}
                    onComplete={(swaggerUI) => {
                      // Check if SwaggerUI rendered successfully
                      if (!swaggerUI?.getSystem) {
                        console.warn('SwaggerUI failed to render properly');
                      }
                    }}
                    requestInterceptor={(request) => {
                      if (spec.id) {
                        const baseUrl = window.location.origin;
                        const url = new URL(request.url);
                        
                        // Preserve the path and query parameters
                        const originalPath = url.pathname;
                        const searchParams = url.search; // This includes the ? and all parameters
                        
                        // Simply prepend the endpoint ID to the path
                        const newPath = `/api/${spec.id}${originalPath}`;
                        
                        // Reconstruct the full URL with parameters
                        request.url = `${baseUrl}${newPath}${searchParams}`;
                      }
                      return request;
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-4">
          <span className="text-5xl">🚀</span>
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Endpoint Generator
          </span>
          <span className="text-5xl">⚡</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Describe your API needs and get a deployed endpoint in seconds. <br />
          <span className="text-gray-500 text-base">For frontend devs by AI devs.</span>
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center px-4 pb-8">
        {/* Chat Interface - Centered like ChatGPT */}
        <div className="w-full max-w-4xl">
          <form onSubmit={handleSubmit} className="relative">
            <div className="bg-white border border-gray-300 rounded-xl shadow-sm">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Describe your API endpoint... (e.g., Create an API that accepts a user's name and returns a personalized greeting)"
                className="w-full px-4 py-4 pr-12 border-0 rounded-xl resize-none focus:outline-none focus:ring-0 min-h-[60px] max-h-[200px]"
                disabled={isLoading}
                rows={3}
              />
              
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-3 bottom-3 p-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="h-4 w-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start">
                
                <div>
                  <p className="mt-1 text-sm text-green-700">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Spec Display */}
        {renderApiSpec(apiSpec, () => handleSubmit({ preventDefault: () => {} }))}
      </div>
    </div>
  );
}
