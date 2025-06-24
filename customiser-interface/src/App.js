import React from 'react';
import DatasetUploader from './components/DatasetUploader';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">ML Ops Dashboard</h1>
            <p className="text-gray-600">Upload datasets to Hugging Face and register them</p>
          </header>
          <main>
            <DatasetUploader />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;