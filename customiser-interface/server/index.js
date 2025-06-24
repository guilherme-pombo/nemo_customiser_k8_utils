const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Dataset uploader backend is running!' });
});

// Execute command endpoint
app.post('/api/execute-command', (req, res) => {
  const { command, env = {} } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  console.log(`Executing command: ${command}`);

  const execOptions = {
    env: { ...process.env, ...env }
  };

  exec(command, execOptions, (error, stdout, stderr) => {
    if (error) {
      console.error(`Command error: ${error.message}`);
      return res.json({ 
        success: false, 
        error: error.message, 
        stderr 
      });
    }
    
    console.log(`Command output: ${stdout}`);
    res.json({ 
      success: true, 
      stdout, 
      stderr 
    });
  });
});

// Upload dataset endpoint (combines all the steps)
app.post('/api/upload-dataset', async (req, res) => {
  const { datasetName, datasetPath, namespace } = req.body;
  
  if (!datasetName || !datasetPath || !namespace) {
    return res.status(400).json({ 
      error: 'datasetName, datasetPath, and namespace are required' 
    });
  }

  const env = {
    HF_ENDPOINT: "http://data-store.test/v1/hf",
    HF_TOKEN: "dummy-unused-value"
  };

  try {
    // Step 1: Create repository
    console.log('Creating repository...');
    const createResult = await executeCommand(
      `huggingface-cli repo create "${datasetName}" --type dataset`,
      env
    );
    
    if (!createResult.success) {
      throw new Error(`Repo create failed: ${createResult.error}`);
    }

    // Step 2: Upload dataset
    console.log('Uploading dataset...');
    const uploadResult = await executeCommand(
      `huggingface-cli upload --repo-type dataset "${namespace}/${datasetName}" "${datasetPath}"`,
      env
    );
    
    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.error}`);
    }

    // Step 3: Register with nemo.test API
    console.log('Registering dataset...');
    try {
      const response = await fetch('http://nemo.test/v1/datasets', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: datasetName,
          namespace: namespace,
          description: "This is an example of a dataset",
          files_url: `hf://datasets/${namespace}/${datasetName}`,
          project: "sample_project"
        })
      });

      const apiResult = await response.json();
      
      res.json({
        success: true,
        steps: {
          create: createResult,
          upload: uploadResult,
          register: apiResult
        }
      });
    } catch (apiError) {
      res.json({
        success: false,
        error: `API registration failed: ${apiError.message}`,
        partialSuccess: {
          create: createResult,
          upload: uploadResult
        }
      });
    }

  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to promisify exec
function executeCommand(command, env = {}) {
  return new Promise((resolve) => {
    const execOptions = {
      env: { ...process.env, ...env }
    };

    exec(command, execOptions, (error, stdout, stderr) => {
      if (error) {
        resolve({ 
          success: false, 
          error: error.message, 
          stderr 
        });
      } else {
        resolve({ 
          success: true, 
          stdout, 
          stderr 
        });
      }
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});