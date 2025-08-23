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

        // Success! Set the API spec and stop retrying
        setApiSpec(data);
        return true;
      } catch (err) {
        attempt++;
        
        if (attempt >= maxRetries) {
          // Max retries reached, show error
          setError(`Sorry, I'm having trouble processing your request right now. Please try again later.`);
          return false;
        }

        // Show user-friendly retry status
        setError(`Still thinking... (attempt ${attempt}/${maxRetries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Recursively try again
        return await attemptRequest();
      }
    };

    try {
      await attemptRequest();
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderApiSpec = (spec) => {
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
        // Return a minimal valid OpenAPI spec as fallback
        return {
          openapi: '3.0.0',
          info: {
            title: 'Generated API',
            version: '1.0.0',
            description: 'API specification could not be parsed'
          },
          paths: {},
          components: {
            schemas: {
              Error: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    description: 'Error message'
                  }
                }
              }
            }
          }
        };
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
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Spec Display */}
        {renderApiSpec(apiSpec)}
      </div>
    </div>
  );
}
