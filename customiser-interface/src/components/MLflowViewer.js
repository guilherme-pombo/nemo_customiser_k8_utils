import React from 'react';

const MLflowViewer = () => {
  // Determine MLflow URL based on your setup
  const mlflowUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000'  // If you're port forwarding MLflow to port 5000
    : 'http://mlflow.test';    // If accessing directly on server

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">MLflow Experiment Tracking</h2>
        <a 
          href={mlflowUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Open in New Tab
        </a>
      </div>
      
      {/* Embedded MLflow UI */}
      <div className="border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <iframe
          src={mlflowUrl}
          title="MLflow UI"
          width="100%"
          height="100%"
          frameBorder="0"
          className="w-full h-full"
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Tip:</strong> Use "Open in New Tab" for the full MLflow experience.
        </p>
      </div>
    </div>
  );
};

export default MLflowViewer;
