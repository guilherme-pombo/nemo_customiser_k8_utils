import React, { useState } from 'react';

const EvaluationRunner = () => {
  const [modelId, setModelId] = useState('');
  const [datasetUrl, setDatasetUrl] = useState('hf://datasets/default/sample-basic-test/testing/testing.jsonl');
  const [maxTokens, setMaxTokens] = useState(20);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [evaluationJobId, setEvaluationJobId] = useState('');

  const runEvaluation = async () => {
    if (!modelId.trim()) {
      setOutput('Error: Model ID is required');
      return;
    }

    if (!datasetUrl.trim()) {
      setOutput('Error: Dataset URL is required');
      return;
    }

    setIsRunning(true);
    setOutput('Starting evaluation...\n');
    setEvaluationJobId('');

    try {
      // Get backend URL (works both locally and when port-forwarded)
      const backendUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001'
        : window.location.origin.replace(':3000', ':3001');

      // Step 1: Create evaluation target
      setOutput(prev => prev + 'Creating evaluation target...\n');
      
      const targetResponse = await fetch(`${backendUrl}/api/evaluation/targets`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "model",
          model: {
            api_endpoint: {
              url: "http://nemo-nim-proxy:8000/v1/completions",
              model_id: modelId
            }
          }
        })
      });

      if (!targetResponse.ok) {
        throw new Error(`Failed to create target: ${targetResponse.statusText}`);
      }

      const targetResult = await targetResponse.json();
      const evaluatorTarget = `default/${targetResult.id}`;
      
      setOutput(prev => prev + `✅ Target created: ${evaluatorTarget}\n`);

      // Step 2: Create evaluation config
      setOutput(prev => prev + 'Creating evaluation config...\n');
      
      const configResponse = await fetch(`${backendUrl}/api/evaluation/configs`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "custom",
          params: { parallelism: 4 },
          tasks: {
            "my-custom-task": {
              type: "completion",
              params: {
                template: {
                  prompt: "{{prompt}}",
                  max_tokens: parseInt(maxTokens),
                  temperature: parseFloat(temperature),
                  top_p: parseFloat(topP)
                }
              },
              dataset: {
                files_url: datasetUrl
              },
              metrics: {
                bleu: {
                  type: "bleu",
                  params: { references: ["{{ideal_response}}"] }
                },
                "string-check": {
                  type: "string-check",
                  params: {
                    check: ["{{ideal_response | trim}}", "equals", "{{output_text | trim}}"]
                  }
                }
              }
            }
          }
        })
      });

      if (!configResponse.ok) {
        throw new Error(`Failed to create config: ${configResponse.statusText}`);
      }

      const configResult = await configResponse.json();
      const evaluatorConfig = `default/${configResult.id}`;
      
      setOutput(prev => prev + `✅ Config created: ${evaluatorConfig}\n`);

      // Step 3: Create evaluation job
      setOutput(prev => prev + 'Starting evaluation job...\n');
      
      const jobResponse = await fetch(`${backendUrl}/api/evaluation/jobs`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: evaluatorTarget,
          config: evaluatorConfig
        })
      });

      if (!jobResponse.ok) {
        throw new Error(`Failed to create job: ${jobResponse.statusText}`);
      }

      const jobResult = await jobResponse.json();
      const jobId = jobResult.id;
      setEvaluationJobId(jobId);
      
      setOutput(prev => prev + `✅ Job created: ${jobId}\n`);
      setOutput(prev => prev + 'Waiting for evaluation results...\n');

      // Step 4: Poll for results
      await pollForResults(jobId);

    } catch (error) {
      setOutput(prev => prev + `❌ Error: ${error.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const pollForResults = async (jobId) => {
    // Get backend URL
    const backendUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001'
      : window.location.origin.replace(':3000', ':3001');
      
    const apiUrl = `${backendUrl}/api/evaluation/jobs/${jobId}/results`;
    
    while (true) {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch results: ${response.statusText}`);
        }

        const results = await response.json();
        
        // Check if we have metrics results
        if (results.tasks && Object.keys(results.tasks).length > 0) {
          const hasMetrics = Object.values(results.tasks).some(task => 
            task.metrics && Object.keys(task.metrics).length > 0
          );
          
          if (hasMetrics) {
            setOutput(prev => prev + '✅ Evaluation completed!\n\n');
            setOutput(prev => prev + '📊 RESULTS SUMMARY:\n');
            setOutput(prev => prev + '='.repeat(50) + '\n\n');
            
            // Format the results nicely
            const tasks = results.tasks;
            Object.entries(tasks).forEach(([taskName, taskData]) => {
              setOutput(prev => prev + `📋 Task: ${taskName}\n`);
              setOutput(prev => prev + '-'.repeat(30) + '\n');
              
              if (taskData.metrics) {
                Object.entries(taskData.metrics).forEach(([metricName, metricData]) => {
                  setOutput(prev => prev + `📈 ${metricName.toUpperCase()}:\n`);
                  
                  if (metricData.scores) {
                    Object.entries(metricData.scores).forEach(([scoreType, scoreData]) => {
                      if (scoreData.value !== undefined) {
                        setOutput(prev => prev + `   ${scoreType}: ${scoreData.value.toFixed(4)}\n`);
                        
                        if (scoreData.stats) {
                          setOutput(prev => prev + `   └─ count: ${scoreData.stats.count}, mean: ${scoreData.stats.mean.toFixed(4)}\n`);
                        }
                      }
                    });
                  }
                  setOutput(prev => prev + '\n');
                });
              }
            });
            
            setOutput(prev => prev + '\n' + '='.repeat(50) + '\n');
            setOutput(prev => prev + '📄 Full JSON Response:\n');
            setOutput(prev => prev + JSON.stringify(results, null, 2) + '\n');
            break;
          }
        }
        
        setOutput(prev => prev + 'evaluating...\n');
        
        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        setOutput(prev => prev + `❌ Polling error: ${error.message}\n`);
        break;
      }
    }
  };

  const stopEvaluation = () => {
    setIsRunning(false);
    setOutput(prev => prev + '⏹️ Evaluation stopped by user\n');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Evaluation Runner</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="modelId" className="block text-sm font-medium text-gray-700 mb-1">
            Model ID
          </label>
          <input
            id="modelId"
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter model ID"
            disabled={isRunning}
          />
        </div>

        <div>
          <label htmlFor="datasetUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Dataset URL
          </label>
          <input
            id="datasetUrl"
            type="text"
            value={datasetUrl}
            onChange={(e) => setDatasetUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., hf://datasets/default/sample-basic-test/testing/testing.jsonl"
            disabled={isRunning}
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports Hugging Face dataset URLs (hf://) or other file URLs
          </p>
        </div>

        {/* Generation Parameters */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Generation Parameters</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="maxTokens" className="block text-sm font-medium text-gray-700 mb-1">
                Max Tokens
              </label>
              <input
                id="maxTokens"
                type="number"
                min="1"
                max="1000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                Temperature
              </label>
              <input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label htmlFor="topP" className="block text-sm font-medium text-gray-700 mb-1">
                Top P
              </label>
              <input
                id="topP"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={topP}
                onChange={(e) => setTopP(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRunning}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-1">
            <p className="text-xs text-gray-500">Maximum response length</p>
            <p className="text-xs text-gray-500">Randomness (0=deterministic, 2=very random)</p>
            <p className="text-xs text-gray-500">Nucleus sampling (0.1=focused, 1.0=diverse)</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={runEvaluation}
            disabled={isRunning || !modelId.trim() || !datasetUrl.trim()}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {isRunning ? 'Running Evaluation...' : 'Start Evaluation'}
          </button>
          
          {isRunning && (
            <button
              onClick={stopEvaluation}
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        {evaluationJobId && (
          <div className="p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Job ID:</strong> {evaluationJobId}
            </p>
          </div>
        )}
      </div>

      {output && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Output:</h3>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default EvaluationRunner;