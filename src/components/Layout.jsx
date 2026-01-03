import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText } from './Icons.jsx';

/**
 * Layout component providing consistent header and page structure
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md mb-6">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <FileText />
              <h1 className="text-2xl font-bold text-gray-800">
                Matematik Prøverettelse
              </h1>
            </button>
            
            {!isHomePage && (
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                ← Tilbage til oversigt
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
