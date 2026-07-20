import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 100%)',
          minHeight: '100vh',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</h1>
          <h2>Something went wrong.</h2>
          <p style={{ opacity: 0.8, maxWidth: '400px', margin: '1rem 0' }}>
            The application encountered an unexpected error. This has been logged for review.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: '#ef4444',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Return to Dashboard
          </button>
          {import.meta.env.DEV && (
            <pre style={{ 
              marginTop: '2rem', 
              textAlign: 'left', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '1rem', 
              borderRadius: '8px',
              fontSize: '0.8rem',
              overflow: 'auto',
              maxWidth: '90%'
            }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
