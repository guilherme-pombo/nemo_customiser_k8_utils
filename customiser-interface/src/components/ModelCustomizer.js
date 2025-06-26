import React, { useState } from 'react';

const ModelCustomizer = () => {
  const [modelConfig, setModelConfig] = useState('');
  const [availableConfigs, setAvailableConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [datasetName, setDatasetName] = useState('sample-basic-test');
  const [datasetNamespace, setDatasetNamespace] = useState('default');
  const [outputModel, setOutputModel] = useState('default/test-example-model@v3');
  
  // Hyperparameters
  const [epochs, setEpochs] = useState(3);
  const [batchSize, setBatchSize] = useState(8);
  const [learningRate, setLearningRate] = useState(0.0001);
  const [adapterDim, setAdapterDim] = useState(16);
  
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [customizationJobId, setCustomizationJobId] = useState('');

  // Load available model configs on component mount
  React.useEffect(() => {
    const loadConfigs = async () => {
      try {
        setLoadingConfigs(true);
        const backendUrl = window.location.hostname === 'localhost' 
          ? 'http://localhost:3001'
          : window.location.origin.replace(':3000', ':3001');

        const response = await fetch(`${backendUrl}/api/customization/configs`);
        if (response.ok) {
          const result = await response.json();
          const configs = result.data.map(config => ({
            value: `${config.namespace}/${config.name}`,
            label: `${config.namespace}/${config.name}`,
            target: config.target
          }));
          setAvailableConfigs(configs);
          
          // Don't set a default - let user choose
        } else {
          console.error('Failed to load configs');
        }
      } catch (error) {
        console.error('Could not load configs:', error.message);
      } finally {
        setLoadingConfigs(false);
      }
    };

    loadConfigs();
  }, []);

  const startCustomization = async () => {
    if (!modelConfig.trim()) {
      setOutput('Error: Model config is required');
      return;
    }

    setIsRunning(true);
    setOutput('Starting model customization...\n');
    setCustomizationJobId('');

    try {
      // Get backend URL
      const backendUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001'
        : window.location.origin.replace(':3000', ':3001');

      // Start customization job
      setOutput(prev => prev + 'Creating customization job...\n');
      
      const jobResponse = await fetch(`${backendUrl}/api/customization/jobs`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: modelConfig,
          dataset: {
            name: datasetName,
            namespace: datasetNamespace
          },
          hyperparameters: {
            training_type: "sft",
            finetuning_type: "lora",
            epochs: parseInt(epochs),
            batch_size: parseInt(batchSize),
            learning_rate: parseFloat(learningRate),
            lora: { 
              adapter_dim: parseInt(adapterDim) 
            }
          },
          project: "test-project",
          ownership: {
            created_by: "me",
            access_policies: {
              arbitrary: "json"
            }
          },
          output_model: outputModel
        })
      });

      if (!jobResponse.ok) {
        throw new Error(`Failed to create customization job: ${jobResponse.statusText}`);
      }

      const jobResult = await jobResponse.json();
      const jobId = jobResult.id;
      setCustomizationJobId(jobId);
      
      setOutput(prev => prev + `✅ Job created: ${jobId}\n`);
      setOutput(prev => prev + 'Training job starting...\n');

      // Wait a bit before starting to poll
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Start polling for status
      await pollForStatus(jobId);

    } catch (error) {
      setOutput(prev => prev + `❌ Error: ${error.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const pollForStatus = async (jobId) => {
    // Get backend URL
    const backendUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001'
      : window.location.origin.replace(':3000', ':3001');
      
    const statusUrl = `${backendUrl}/api/customization/jobs/${jobId}/status`;
    
    while (true) {
      try {
        const response = await fetch(statusUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }

        const statusResult = await response.json();
        const status = statusResult.status;
        
        // Display progress info
        const progressInfo = {
          steps_completed: statusResult.steps_completed || 'N/A',
          train_loss: statusResult.train_loss || 'N/A',
          val_loss: statusResult.val_loss || 'N/A'
        };
        
        setOutput(prev => prev + `📊 Progress: ${JSON.stringify(progressInfo, null, 2)}\n`);
        
        if (status !== "running") {
          setOutput(prev => prev + `🏁 Training job finished with status: ${status}\n`);
          
          if (status === "completed") {
            setOutput(prev => prev + '✅ Model customization completed successfully!\n');
          } else {
            setOutput(prev => prev + `⚠️ Training ended with status: ${status}\n`);
          }
          break;
        }
        
        // Wait 10 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        setOutput(prev => prev + `❌ Polling error: ${error.message}\n`);
        break;
      }
    }
  };

  const stopCustomization = () => {
    setIsRunning(false);
    setOutput(prev => prev + '⏹️ Customization stopped by user\n');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Model Customizer (LoRA)</h2>
      
      <div className="space-y-6">
        {/* Basic Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="modelConfig" className="block text-sm font-medium text-gray-700 mb-1">
              Model Config *
            </label>
            {loadingConfigs ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                Loading available configurations...
              </div>
            ) : availableConfigs.length > 0 ? (
              <select
                id="modelConfig"
                value={modelConfig}
                onChange={(e) => setModelConfig(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              >
                <option value="">Select a model configuration...</option>
                {availableConfigs.map((config) => (
                  <option key={config.value} value={config.value}>
                    {config.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="modelConfig"
                type="text"
                value={modelConfig}
                onChange={(e) => setModelConfig(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter model config (e.g., meta/llama-3.2-1b-instruct@v1.0.0+A100)"
                disabled={isRunning}
              />
            )}
            {availableConfigs.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {availableConfigs.length} configurations available
              </p>
            )}
          </div>

          <div>
            <label htmlFor="outputModel" className="block text-sm font-medium text-gray-700 mb-1">
              Output Model Name
            </label>
            <input
              id="outputModel"
              type="text"
              value={outputModel}
              onChange={(e) => setOutputModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="default/test-example-model@v3"
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Dataset Configuration */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">Dataset Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                disabled={isRunning}
              />
            </div>

            <div>
              <label htmlFor="datasetNamespace" className="block text-sm font-medium text-gray-700 mb-1">
                Dataset Namespace
              </label>
              <input
                id="datasetNamespace"
                type="text"
                value={datasetNamespace}
                onChange={(e) => setDatasetNamespace(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Training Hyperparameters</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="epochs" className="block text-sm font-medium text-gray-700 mb-1">
                Epochs
              </label>
              <input
                id="epochs"
                type="number"
                min="1"
                max="100"
                value={epochs}
                onChange={(e) => setEpochs(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <input
                id="batchSize"
                type="number"
                min="1"
                max="128"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label htmlFor="learningRate" className="block text-sm font-medium text-gray-700 mb-1">
                Learning Rate
              </label>
              <input
                id="learningRate"
                type="number"
                min="0.0001"
                max="0.01"
                step="0.0001"
                value={learningRate}
                onChange={(e) => setLearningRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label htmlFor="adapterDim" className="block text-sm font-medium text-gray-700 mb-1">
                LoRA Adapter Dim
              </label>
              <input
                id="adapterDim"
                type="number"
                min="1"
                max="512"
                value={adapterDim}
                onChange={(e) => setAdapterDim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
            <p className="text-xs text-gray-500">Number of training iterations</p>
            <p className="text-xs text-gray-500">Samples processed together</p>
            <p className="text-xs text-gray-500">Step size for optimization</p>
            <p className="text-xs text-gray-500">LoRA rank/dimension</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={startCustomization}
            disabled={isRunning || !modelConfig.trim()}
            className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {isRunning ? 'Training in Progress...' : 'Start Model Customization'}
          </button>
          
          {isRunning && (
            <button
              onClick={stopCustomization}
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        {customizationJobId && (
          <div className="p-3 bg-purple-50 rounded-md">
            <p className="text-sm text-purple-800">
              <strong>Customization Job ID:</strong> {customizationJobId}
            </p>
          </div>
        )}
      </div>

      {output && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Training Progress:</h3>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ModelCustomizer;