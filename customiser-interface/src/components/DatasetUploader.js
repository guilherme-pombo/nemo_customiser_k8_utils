import React, { useState } from 'react';

const DatasetUploader = () => {
  const [datasetName, setDatasetName] = useState('');
  const [datasetPath, setDatasetPath] = useState('');
  const [namespace, setNamespace] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('');

  const uploadDataset = async () => {
    // Validate inputs
    if (!datasetName || !datasetPath || !namespace) {
      setOutput('Error: All fields are required');
      return;
    }

    setIsLoading(true);
    setOutput('Processing...\n');

    try {
      // If running locally, use localhost. If remote, use relative path through proxy
      const backendUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001'
        : window.location.origin.replace(':3000', ':3001');
        
      const response = await fetch(`${backendUrl}/api/upload-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetName,
          datasetPath,
          namespace
        })
      });

      const result = await response.json();

      if (result.success) {
        setOutput('✅ Dataset uploaded successfully!\n\nDetails:\n' + 
          `• Repository created: ${result.steps.create.stdout}\n` +
          `• Dataset uploaded: ${result.steps.upload.stdout}\n` +
          `• API registration: ${JSON.stringify(result.steps.register, null, 2)}`
        );
      } else if (result.partialSuccess) {
        setOutput('⚠️ Partial success - dataset uploaded but API registration failed:\n\n' +
          `Error: ${result.error}\n\n` +
          `• Repository created: ${result.partialSuccess.create.stdout}\n` +
          `• Dataset uploaded: ${result.partialSuccess.upload.stdout}`
        );
      } else {
        setOutput(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setOutput(`❌ Network error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dataset Uploader</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="datasetName" className="block text-sm font-medium text-gray-700 mb-1">
            Dataset Name
          </label>
          <input
            id="datasetName"
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter dataset name"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="datasetPath" className="block text-sm font-medium text-gray-700 mb-1">
            Dataset Path
          </label>
          <input
            id="datasetPath"
            type="text"
            value={datasetPath}
            onChange={(e) => setDatasetPath(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter dataset path"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="namespace" className="block text-sm font-medium text-gray-700 mb-1">
            Namespace
          </label>
          <input
            id="namespace"
            type="text"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter namespace"
            disabled={isLoading}
          />
        </div>

        <button
          onClick={uploadDataset}
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {isLoading ? 'Processing...' : 'Upload Dataset'}
        </button>
      </div>

      {output && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Output:</h3>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DatasetUploader;