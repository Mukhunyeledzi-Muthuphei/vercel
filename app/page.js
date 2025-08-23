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

    try {
      const response = await fetch('/api/submit-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit query');
      }

      const data = await response.json();
      setApiSpec(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderApiSpec = (spec) => {
    if (!spec) return null;

    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">Generated API Endpoint</h3>
        
        {spec.id && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Endpoint ID:</h4>
            <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
              {spec.id}
            </code>
          </div>
        )}

        {spec.endpoint && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Endpoint URL:</h4>
            <code className="bg-blue-50 text-blue-800 px-3 py-1 rounded text-sm font-mono">
              {spec.endpoint}
            </code>
          </div>
        )}

        {spec.spec && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-4">Interactive API Documentation:</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <SwaggerUI 
                spec={(() => {
                  try {
                    // First try to parse as JSON
                    return JSON.parse(spec.spec);
                  } catch (jsonError) {
                    // If JSON fails, try YAML
                    return parse(spec.spec.replace(/\\n/g, '\n'));
                  }
                })()}
                docExpansion="list"
                defaultModelsExpandDepth={1}
                defaultModelExpandDepth={1}
                tryItOutEnabled={true}
                requestInterceptor={(request) => {
                  // Inject the endpoint ID into the URL path
                  if (spec.id) {
                    const baseUrl = window.location.origin;
                    // Extract the path from the request URL and prepend the endpoint ID
                    const url = new URL(request.url);
                    const path = url.pathname;
                    // Remove the base path if it exists and prepend the endpoint ID
                    const newPath = `/api/${spec.id}${path.replace('/api', '')}`;
                    request.url = `${baseUrl}${newPath}`;
                  }
                  return request;
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Endpoint Generator
          </h1>
          <p className="text-lg text-gray-600">
            Describe your API needs and get a deployable endpoint instantly
          </p>
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                Describe your API endpoint
              </label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Create an API that accepts a user's name and returns a personalized greeting with the current weather for their location"
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isLoading}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating endpoint...
                </>
              ) : (
                'Generate Endpoint'
              )}
            </button>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* API Spec Display */}
        {renderApiSpec(apiSpec)}
      </div>
    </div>
  );
}
