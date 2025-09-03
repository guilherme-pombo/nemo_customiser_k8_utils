import os
import json
import requests
from time import sleep, time
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from nemo_microservices import NeMoMicroservices
from huggingface_hub import HfApi
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class NeMoMicroservicesManager:
    """Manager class for NeMo Microservices operations"""
    
    def __init__(self, nemo_url: str, nim_url: str, nds_url: str, nds_token: str = "token"):
        """
        Initialize NeMo Microservices Manager
        
        Args:
            nemo_url: URL for NeMo services (Entity Store, Customizer, Evaluator)
            nim_url: URL for NIM inference service
            nds_url: URL for Data Store
            nds_token: Token for Data Store authentication
        """
        self.nemo_url = nemo_url
        self.nim_url = nim_url
        self.nds_url = nds_url
        self.nds_token = nds_token
        
        # Initialize NeMo client
        self.client = NeMoMicroservices(
            base_url=nemo_url,
            inference_base_url=nim_url,
        )
        
        # Initialize HuggingFace API for data store
        self.hf_api = HfApi(endpoint=f"{nds_url}/v1/hf", token="")
        
        logger.info(f"Initialized NeMo Manager with endpoints:")
        logger.info(f"  NeMo URL: {nemo_url}")
        logger.info(f"  NIM URL: {nim_url}")
        logger.info(f"  Data Store URL: {nds_url}")

    # ==================== Namespace Management ====================
    
    def create_namespace(self, namespace: str) -> None:
        """
        Create namespace in both Entity Store and Data Store
        
        Args:
            namespace: Name of the namespace to create
        """
        # Create namespace in Entity Store
        try:
            namespace_obj = self.client.namespaces.create(id=namespace)
            logger.info(f"Created namespace in Entity Store: {namespace_obj.id}")
        except Exception as e:
            if "409" in str(e) or "422" in str(e):
                logger.info(f"Namespace {namespace} already exists in Entity Store")
            else:
                raise e

        # Create namespace in Data Store
        nds_url = f"{self.nds_url}/v1/datastore/namespaces"
        resp = requests.post(nds_url, data={"namespace": namespace})
        if resp.status_code in (200, 201):
            logger.info(f"Created namespace in Data Store: {namespace}")
        elif resp.status_code in (409, 422):
            logger.info(f"Namespace {namespace} already exists in Data Store")
        else:
            raise Exception(f"Failed to create namespace in Data Store: {resp.status_code} - {resp.text}")

    def verify_namespace(self, namespace: str) -> bool:
        """
        Verify namespace exists in both stores
        
        Args:
            namespace: Name of the namespace to verify
            
        Returns:
            True if namespace exists in both stores
        """
        try:
            # Check Entity Store
            namespace_obj = self.client.namespaces.retrieve(namespace_id=namespace)
            
            # Check Data Store
            response = requests.get(f"{self.nds_url}/v1/datastore/namespaces/{namespace}")
            
            return namespace_obj is not None and response.status_code in (200, 201)
        except:
            return False

    # ==================== Dataset Management ====================
    
    def create_dataset(self, 
                      namespace: str,
                      dataset_name: str,
                      train_file: str,
                      val_file: str,
                      test_file: str,
                      description: str = "",
                      project: Optional[str] = None) -> Dict:
        """
        Create and upload dataset to NeMo Data Store
        
        Args:
            namespace: Namespace for the dataset
            dataset_name: Name of the dataset
            train_file: Path to training data file
            val_file: Path to validation data file
            test_file: Path to test data file
            description: Dataset description
            project: Project name (optional)
            
        Returns:
            Created dataset object
        """
        repo_id = f"{namespace}/{dataset_name}"
        
        # Create repository in Data Store
        try:
            self.hf_api.create_repo(
                repo_id=repo_id,
                repo_type='dataset',
            )
            logger.info(f"Created dataset repository: {repo_id}")
        except Exception as e:
            if "409" in str(e):
                logger.info(f"Dataset repository {repo_id} already exists")
            else:
                raise e
        
        # Upload dataset files
        logger.info("Uploading dataset files...")
        
        self.hf_api.upload_file(
            path_or_fileobj=train_file,
            path_in_repo="training/train.jsonl",
            repo_id=repo_id,
            repo_type='dataset',
        )
        logger.info(f"Uploaded training data: {train_file}")
        
        self.hf_api.upload_file(
            path_or_fileobj=val_file,
            path_in_repo="validation/val.jsonl",
            repo_id=repo_id,
            repo_type='dataset',
        )
        logger.info(f"Uploaded validation data: {val_file}")
        
        self.hf_api.upload_file(
            path_or_fileobj=test_file,
            path_in_repo="testing/test.jsonl",
            repo_id=repo_id,
            repo_type='dataset',
        )
        logger.info(f"Uploaded test data: {test_file}")
        
        # Create dataset in Entity Store
        dataset = self.client.datasets.create(
            name=dataset_name,
            namespace=namespace,
            description=description,
            files_url=f"hf://datasets/{namespace}/{dataset_name}",
            project=project,
        )
        logger.info(f"Created dataset in Entity Store: {dataset.namespace}/{dataset.name}")
        
        return dataset

    def retrieve_dataset(self, namespace: str, dataset_name: str):
        """
        Retrieve dataset from Entity Store
        
        Args:
            namespace: Namespace of the dataset
            dataset_name: Name of the dataset
            
        Returns:
            Dataset object
        """
        return self.client.datasets.retrieve(namespace=namespace, dataset_name=dataset_name)

    # ==================== Model Deployment ====================
    
    def deploy_nim(self,
                   model_name: str,
                   namespace: str,
                   base_model: str,
                   image_name: str,
                   image_tag: str = "1.8",
                   gpu: int = 1,
                   pvc_size: str = "25Gi",
                   additional_envs: Optional[Dict] = None,
                   wait: bool = True,
                   timeout: int = 600) -> Any:
        """
        Deploy a NIM model
        
        Args:
            model_name: Name for the deployment
            namespace: Namespace for the deployment
            base_model: Base model identifier
            image_name: Docker image name
            image_tag: Docker image tag
            gpu: Number of GPUs
            pvc_size: PVC size for storage
            additional_envs: Additional environment variables
            wait: Whether to wait for deployment to complete
            timeout: Timeout in seconds if waiting
            
        Returns:
            Deployment object
        """
        if additional_envs is None:
            additional_envs = {"NIM_GUIDED_DECODING_BACKEND": "fast_outlines"}
        try:
            deployment = self.client.deployment.model_deployments.create(
                name=model_name,
                namespace=namespace,
                config={
                    "model": base_model,
                    "nim_deployment": {
                        "image_name": image_name,
                        "image_tag": image_tag,
                        "pvc_size": pvc_size,
                        "gpu": gpu,
                        "additional_envs": additional_envs
                    }
                }
            )
            logger.info(f"Created deployment: {model_name} in namespace {namespace}")

            if wait:
                deployment = self.wait_for_deployment(model_name, namespace, timeout)
            return deployment
        
        except Exception as e:
            if "500" in str(e):
                logger.error(f"model deployment already exists!")
                deployment = self.client.deployment.model_deployments.retrieve(namespace=namespace,
                                                                               deployment_name=model_name)
            return deployment

    def wait_for_deployment(self, model_name: str, namespace: str, timeout: int = 600) -> Any:
        """
        Wait for model deployment to complete
        
        Args:
            model_name: Name of the deployment
            namespace: Namespace of the deployment
            timeout: Timeout in seconds
            
        Returns:
            Deployment object when ready
        """
        start_time = time()
        
        while time() - start_time < timeout:
            try:
                deployment = self.client.deployment.model_deployments.retrieve(
                    deployment_name=model_name,
                    namespace=namespace
                )
                
                if deployment.deployed:
                    logger.info(f"Deployment {model_name} is ready")
                    return deployment
                
                logger.info(f"Waiting for deployment {model_name}... Status: {deployment.status_details.status}")
                sleep(10)
                
            except Exception as e:
                logger.warning(f"Error checking deployment status: {e}")
                sleep(10)
        
        raise TimeoutError(f"Deployment {model_name} did not complete within {timeout} seconds")

    # ==================== Model Customization ====================
    
    def create_customization_job(self,
                                job_name: str,
                                output_model: str,
                                config: str,
                                dataset_name: str,
                                dataset_namespace: str,
                                hyperparameters: Dict,
                                wandb_api_key: Optional[str] = None) -> Any:
        """
        Create a model customization job
        
        Args:
            job_name: Name for the customization job
            output_model: Output model identifier
            config: Base model configuration
            dataset_name: Name of the dataset
            dataset_namespace: Namespace of the dataset
            hyperparameters: Training hyperparameters
            wandb_api_key: Optional WandB API key for tracking
            
        Returns:
            Customization job object
        """
        # Prepare client with WandB if key provided
        client = self.client
        if wandb_api_key:
            client = self.client.with_options(default_headers={"wandb-api-key": wandb_api_key})
        
        customization = client.customization.jobs.create(
            name=job_name,
            output_model=output_model,
            config=config,
            dataset={"name": dataset_name, "namespace": dataset_namespace},
            hyperparameters=hyperparameters
        )
        
        logger.info(f"Created customization job: {customization.id}")
        return customization

    def wait_for_customization(self, job_id: str, polling_interval: int = 100, timeout: int = 6000) -> Any:
        """
        Wait for customization job to complete
        
        Args:
            job_id: ID of the customization job
            polling_interval: Seconds between status checks
            timeout: Maximum wait time in seconds
            
        Returns:
            Completed job object
        """
        start_time = time()
        
        while time() - start_time < timeout:
            job = self.client.customization.jobs.retrieve(job_id=job_id)
            status = job.status
            
            if status == "completed":
                logger.info(f"Customization job {job_id} completed successfully")
                return job
            elif status == "failed":
                raise Exception(f"Customization job {job_id} failed: {job.status_details}")
            elif status in ["pending", "created", "running"]:
                progress = 0.0
                if status == "running" and job.status_details:
                    progress = job.status_details.percentage_done or 0.0
                    logger.info(f"Job {job_id} status: {status}, Progress: {progress:.1f}% \
                                Steps Completed: {job.status_details.steps_completed}")

                else:
                    logger.info(f"Job {job_id} status: {status}")
                sleep(polling_interval)
            else:
                logger.warning(f"Unknown job status: {status}")
                sleep(polling_interval)
        
        raise TimeoutError(f"Customization job {job_id} did not complete within {timeout} seconds")

    def verify_model_deployed(self, model_name: str, max_retries: int = 24, retry_interval: int = 5) -> bool:
        """
        Verify that a customized model is deployed in NIM
        
        Args:
            model_name: Full model identifier (namespace/name)
            max_retries: Maximum number of retries
            retry_interval: Seconds between retries
            
        Returns:
            True if model is deployed
        """
        for i in range(max_retries):
            try:
                models = self.client.inference.models.list()
                model_names = [model.id for model in models.data]
                
                if model_name in model_names:
                    logger.info(f"Model {model_name} is available in NIM")
                    return True
                
                logger.info(f"Waiting for model {model_name} to be available in NIM... ({i+1}/{max_retries})")
                sleep(retry_interval)
                
            except Exception as e:
                logger.warning(f"Error checking model availability: {e}")
                sleep(retry_interval)
        
        return False

    # ==================== Model Evaluation ====================
    
    def create_evaluation_job(self,
                             model: str,
                             dataset_namespace: str,
                             dataset_name: str,
                             test_file_path: str,
                             limit: int = 50,
                             parallelism: int = 8,
                             max_tokens: int = 20,
                             temperature: float = 0.7,
                             top_p: float = 0.9) -> Any:
        """
        Create an evaluation job for a model
        
        Args:
            model: Model identifier to evaluate
            dataset_namespace: Namespace of the dataset
            dataset_name: Name of the dataset
            test_file_path: Path to test file in dataset
            limit: Number of samples to evaluate
            parallelism: Number of parallel evaluations
            max_tokens: Maximum tokens for generation
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            
        Returns:
            Evaluation job object
        """
        config = {
            "type": "custom",
            "params": {
                "parallelism": parallelism
            },
            "tasks": {
                "qa": {
                    "type": "chat-completion",
                    "params": {
                        "template": {
                            "messages": [
                                {"role": "user", "content": "{{item.prompt}}"},
                            ],
                            "max_tokens": max_tokens,
                            "temperature": temperature,
                            "top_p": top_p
                        }
                    },
                    "metrics": {
                        "f1": {
                            "type": "f1",
                            "params": {"ground_truth": "{{item.completion | trim}}"}
                        },
                        "string-check": {
                            "type": "string-check",
                            "params": {
                                "check": ["{{item.completion | trim}}", "equals", "{{output_text | trim}}"]
                            }
                        }
                    },
                    "dataset": {
                        "files_url": f"hf://datasets/{dataset_namespace}/{dataset_name}/{test_file_path}",
                        # "limit": limit
                    }
                }
            }
        }
        
        eval_job = self.client.evaluation.jobs.create(
            config=config,
            target={"type": "model", "model": model}
        )
        
        logger.info(f"Created evaluation job: {eval_job.id}")
        return eval_job

    def wait_for_evaluation(self, job_id: str, polling_interval: int = 10, timeout: int = 600) -> Any:
        """
        Wait for evaluation job to complete
        
        Args:
            job_id: ID of the evaluation job
            polling_interval: Seconds between status checks
            timeout: Maximum wait time in seconds
            
        Returns:
            Completed evaluation job object
        """
        start_time = time()
        
        while time() - start_time < timeout:
            job = self.client.evaluation.jobs.retrieve(job_id=job_id)
            status = job.status
            
            if status == "completed":
                logger.info(f"Evaluation job {job_id} completed successfully")
                return job
            elif status == "failed":
                raise Exception(f"Evaluation job {job_id} failed")
            elif status in ["pending", "created", "running"]:
                progress = 0
                if status == "running" and job.status_details:
                    progress = job.status_details.progress or 0
                
                logger.info(f"Evaluation job {job_id} status: {status}, Progress: {progress}%")
                sleep(polling_interval)
            else:
                logger.warning(f"Unknown evaluation status: {status}")
                sleep(polling_interval)
        
        raise TimeoutError(f"Evaluation job {job_id} did not complete within {timeout} seconds")

    def get_evaluation_results(self, job_id: str) -> Tuple[Any, Any]:
        """
        Get evaluation results
        
        Args:
            job_id: ID of the evaluation job
            
        Returns:
            Tuple of (results object, results zip)
        """
        results = self.client.evaluation.jobs.results(job_id)
        results_zip = self.client.evaluation.jobs.download_results(job_id)
        
        return results, results_zip

    def save_evaluation_results(self, job_id: str, output_path: str = "evaluation_results.zip") -> Dict:
        """
        Save evaluation results to file and return metrics
        
        Args:
            job_id: ID of the evaluation job
            output_path: Path to save results zip
            
        Returns:
            Dictionary with evaluation metrics
        """
        results, results_zip = self.get_evaluation_results(job_id)
        
        # Save zip file
        results_zip.write_to_file(output_path)
        logger.info(f"Saved evaluation results to {output_path}")
        
        # Extract metrics
        metrics = {}
        if results.tasks and 'qa' in results.tasks:
            qa_task = results.tasks['qa']
            if qa_task.metrics:
                for metric_name, metric_result in qa_task.metrics.items():
                    if metric_result.scores:
                        for score_name, score in metric_result.scores.items():
                            metrics[f"{metric_name}_{score_name}"] = score.value
        
        logger.info(f"Evaluation metrics: {metrics}")
        return metrics

    # ==================== Inference ====================
    
    def generate_completions(self,
                            model: str,
                            messages: List[Dict],
                            temperature: float = 0.1,
                            top_p: float = 0.7,
                            max_tokens: int = 512,
                            stream: bool = False) -> str:
        """
        Generate completions using a model
        
        Args:
            model: Model identifier
            messages: List of message dictionaries
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            max_tokens: Maximum tokens to generate
            stream: Whether to stream responses
            
        Returns:
            Generated text
        """
        completion = self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            stream=stream
        )
        
        return completion.choices[0].message.content

    def batch_generate_completions(self,
                                  model: str,
                                  message_batches: List[List[Dict]],
                                  temperature: float = 0.1,
                                  top_p: float = 0.7,
                                  max_tokens: int = 512,
                                  progress_interval: int = 100) -> List[str]:
        """
        Generate completions for multiple message batches
        
        Args:
            model: Model identifier
            message_batches: List of message batches
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            max_tokens: Maximum tokens to generate
            progress_interval: How often to log progress
            
        Returns:
            List of generated texts
        """
        responses = []
        total_messages = sum(len(batch) for batch in message_batches)
        processed = 0
        
        for batch in message_batches:
            for message in batch:
                response = self.generate_completions(
                    model=model,
                    messages=[message],
                    temperature=temperature,
                    top_p=top_p,
                    max_tokens=max_tokens
                )
                responses.append(response)
                processed += 1
                
                if processed % progress_interval == 0:
                    logger.info(f"Processed {processed}/{total_messages} messages")
        
        logger.info(f"Completed batch generation: {len(responses)} responses")
        return responses

    # ==================== Utility Functions ====================
    
    def list_models(self, namespace: Optional[str] = None) -> List[Dict]:
        """
        List available models
        
        Args:
            namespace: Optional namespace filter
            
        Returns:
            List of model dictionaries
        """
        if namespace:
            models_page = self.client.models.list(
                filter={"namespace": namespace},
                sort="-created_at"
            )
        else:
            models_page = self.client.models.list(sort="-created_at")
        
        models = []
        for model in models_page.data:
            model_dict = {
                "name": model.name,
                "namespace": model.namespace,
                "base_model": model.base_model,
                "created_at": model.created_at
            }
            if model.peft:
                model_dict["finetuning_type"] = model.peft.finetuning_type
            models.append(model_dict)
        
        return models

    def list_customization_configs(self, training_type: str = "sft", finetuning_type: str = "lora") -> List:
        """
        List available customization configurations
        
        Args:
            training_type: Type of training (e.g., "sft")
            finetuning_type: Type of fine-tuning (e.g., "lora")
            
        Returns:
            List of configuration objects
        """
        configs = self.client.customization.configs.list(
            page=1,
            page_size=10,
            sort="-created_at",
            filter={
                "training_type": training_type,
                "finetuning_type": finetuning_type,
                "enabled": True
            }
        )
        
        return configs.data

    def get_job_status(self, job_id: str, job_type: str = "customization") -> Dict:
        """
        Get status of a job
        
        Args:
            job_id: ID of the job
            job_type: Type of job ("customization" or "evaluation")
            
        Returns:
            Status dictionary
        """
        if job_type == "customization":
            job = self.client.customization.jobs.retrieve(job_id=job_id)
            return {
                "id": job_id,
                "status": job.status,
                "progress": job.status_details.percentage_done if job.status_details else 0,
                "details": job.status_details
            }
        elif job_type == "evaluation":
            job = self.client.evaluation.jobs.retrieve(job_id=job_id)
            return {
                "id": job_id,
                "status": job.status,
                "progress": job.status_details.progress if job.status_details else 0,
                "details": job.status_details
            }
        else:
            raise ValueError(f"Unknown job type: {job_type}")

    def cleanup_resources(self, namespace: str, delete_models: bool = False, delete_datasets: bool = False):
        """
        Cleanup resources in a namespace
        
        Args:
            namespace: Namespace to clean up
            delete_models: Whether to delete models
            delete_datasets: Whether to delete datasets
        """
        if delete_models:
            models = self.list_models(namespace=namespace)
            for model in models:
                try:
                    self.client.models.delete(
                        namespace=namespace,
                        model_name=model['name']
                    )
                    logger.info(f"Deleted model: {namespace}/{model['name']}")
                except Exception as e:
                    logger.error(f"Failed to delete model {model['name']}: {e}")
        
        if delete_datasets:
            # Note: Dataset deletion might require additional implementation
            logger.warning("Dataset deletion not fully implemented in SDK")

