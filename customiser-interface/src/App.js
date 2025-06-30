import React, { useState } from 'react';
import DatasetUploader from './components/DatasetUploader';
import EvaluationRunner from './components/EvaluationRunner';
import ModelCustomizer from './components/ModelCustomizer';
import MLflowViewer from './components/MLflowViewer';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('datasets');

  return (
    <div className="App">
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Model Distillation Dashboard</h1>
            <p className="text-gray-600">Upload datasets, run evaluations, customize models, and track experiments</p>
          </header>
          
          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg shadow-sm p-1">
              <button
                onClick={() => setActiveTab('datasets')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'datasets'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                Dataset Uploader
              </button>
              <button
                onClick={() => setActiveTab('evaluation')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'evaluation'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                Evaluation Runner
              </button>
              <button
                onClick={() => setActiveTab('customization')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'customization'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                Model Customizer
              </button>
              <button
                onClick={() => setActiveTab('mlflow')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'mlflow'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                MLflow Viewer
              </button>
            </div>
          </div>

          <main>
            {activeTab === 'datasets' && <DatasetUploader />}
            {activeTab === 'evaluation' && <EvaluationRunner />}
            {activeTab === 'customization' && <ModelCustomizer />}
            {activeTab === 'mlflow' && <MLflowViewer />}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
