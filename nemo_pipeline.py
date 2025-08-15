import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Optional
from nemo_microservices_utils import NeMoMicroservicesManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_config(config_file: Optional[str] = None) -> Dict:
    """Load configuration from file or use defaults"""
    
    default_config = {
        "nds_url": "http://data-store.test",
        "nemo_url": "http://nemo.test",
        "nim_url": "http://nim.test",
        "nds_token": "token",
        "namespace": "lora-tutorial-ns",
        "dataset_name": "news-lora-dataset",
        "base_model": "meta/llama-3.2-1b-instruct",
        "base_model_version": "v1.0.0+A100",
        "custom_model_name": "llama-3.2-1b-custom",
        "wandb_api_key": None
    }
    
    if config_file and Path(config_file).exists():
        with open(config_file, 'r') as f:
            file_config = json.load(f)
            default_config.update(file_config)
    
    return default_config


def run_deployment_phase(manager: NeMoMicroservicesManager, config: Dict, args: argparse.Namespace) -> bool:
    """Run the deployment phase"""
    
    if not args.deploy:
        logger.info("Skipping deployment phase")
        return True
    
    logger.info("=" * 50)
    logger.info("PHASE 1: Model Deployment")
    logger.info("=" * 50)
    
    try:
        # Deploy base model NIM
        deployment = manager.deploy_nim(
            model_name=f"{config['base_model'].split('/')[-1]}-deployment",
            namespace=config['base_model'].split('/')[0],
            base_model=config['base_model'],
            image_name=f"nvcr.io/nim/{config['base_model']}",
            image_tag="1.8",
            gpu=args.gpu_count,
            pvc_size=args.pvc_size,
            wait=True,
            timeout=args.deployment_timeout
        )
        
        logger.info(f"Successfully deployed model: {config['base_model']}")
        return True
        
    except Exception as e:
        logger.error(f"Deployment failed: {e}")
        return False


def run_dataset_preparation_phase(manager: NeMoMicroservicesManager, config: Dict, args: argparse.Namespace) -> bool:
    """Run the dataset preparation phase"""
    
    if not args.prepare_dataset:
        logger.info("Skipping dataset preparation phase")
        return True
    
    logger.info("=" * 50)
    logger.info("PHASE 2: Dataset Preparation")
    logger.info("=" * 50)
    
    try:
        # Verify data files exist
        train_file = Path(args.data_dir) / "training.jsonl"
        val_file = Path(args.data_dir) / "validation.jsonl"
        test_file = Path(args.data_dir) / "test.jsonl"
        
        for file in [train_file, val_file, test_file]:
            if not file.exists():
                raise FileNotFoundError(f"Required data file not found: {file}")
        
        # Create namespace if needed
        logger.info(f"Creating namespace: {config['namespace']}")
        manager.create_namespace(config['namespace'])
        
        # Create and upload dataset
        dataset = manager.create_dataset(
            namespace=config['namespace'],
            dataset_name=config['dataset_name'],
            train_file=str(train_file),
            val_file=str(val_file),
            test_file=str(test_file),
            description="Dataset for model customization",
            project=args.project
        )
        
        logger.info(f"Successfully created dataset: {config['namespace']}/{config['dataset_name']}")
        return True
        
    except Exception as e:
        logger.error(f"Dataset preparation failed: {e}")
        return False


def run_customization_phase(manager: NeMoMicroservicesManager, config: Dict, args: argparse.Namespace) -> Optional[str]:
    """Run the model customization phase"""
    
    if not args.customize:
        logger.info("Skipping customization phase")
        return None
    
    logger.info("=" * 50)
    logger.info("PHASE 3: Model Customization")
    logger.info("=" * 50)
    
    try:
        # Check available configurations
        configs = manager.list_customization_configs()
        if not configs:
            raise Exception("No customization configurations available")
        
        logger.info(f"Found {len(configs)} customization configurations")
        for cfg in configs:
            logger.info(f"  - {cfg.namespace}/{cfg.name}")
        
        # Prepare hyperparameters
        hyperparameters = {
            "sequence_packing_enabled": args.sequence_packing,
            "training_type": "sft",
            "finetuning_type": "lora",
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.learning_rate,
            "lora": {
                "adapter_dim": args.lora_dim,
                "adapter_dropout": args.lora_dropout
            }
        }
        
        # Create output model name with version
        output_model = f"{config['namespace']}/{config['custom_model_name']}@v{args.model_version}"
        
        # Create customization job
        logger.info(f"Creating customization job for output model: {output_model}")
        customization_job = manager.create_customization_job(
            job_name=f"{config['custom_model_name']}-customization",
            output_model=output_model,
            config=f"{config['base_model']}@{config['base_model_version']}",
            dataset_name=config['dataset_name'],
            dataset_namespace=config['namespace'],
            hyperparameters=hyperparameters,
            wandb_api_key=config.get('wandb_api_key')
        )
        
        # Wait for customization to complete
        logger.info(f"Waiting for customization job: {customization_job.id}")
        completed_job = manager.wait_for_customization(
            job_id=customization_job.id,
            polling_interval=args.poll_interval,
            timeout=args.customization_timeout
        )
        
        # Wait for model to be available in NIM
        logger.info(f"Waiting for model {output_model} to be available in NIM...")
        if manager.verify_model_deployed(output_model, max_retries=24, retry_interval=5):
            logger.info(f"Successfully customized model: {output_model}")
            return output_model
        else:
            logger.warning(f"Model {output_model} may not be fully deployed yet")
            return output_model
            
    except Exception as e:
        logger.error(f"Customization failed: {e}")
        return None


def run_evaluation_phase(manager: NeMoMicroservicesManager, config: Dict, args: argparse.Namespace, model_name: Optional[str] = None) -> Dict:
    """Run the model evaluation phase"""
    
    if not args.evaluate:
        logger.info("Skipping evaluation phase")
        return {}
    
    logger.info("=" * 50)
    logger.info("PHASE 4: Model Evaluation")
    logger.info("=" * 50)
    
    try:
        # Determine which model to evaluate
        if model_name:
            eval_model = model_name
        elif args.eval_model:
            eval_model = args.eval_model
        else:
            eval_model = config['base_model']
        
        logger.info(f"Evaluating model: {eval_model}")
        
        # Create evaluation job
        eval_job = manager.create_evaluation_job(
            model=eval_model,
            dataset_namespace=config['namespace'],
            dataset_name=config['dataset_name'],
            test_file_path="testing/test.jsonl",
            limit=args.eval_samples,
            parallelism=args.eval_parallelism,
            max_tokens=args.eval_max_tokens,
            temperature=args.eval_temperature,
            top_p=args.eval_top_p
        )
        
        # Wait for evaluation to complete
        logger.info(f"Waiting for evaluation job: {eval_job.id}")
        completed_job = manager.wait_for_evaluation(
            job_id=eval_job.id,
            polling_interval=args.poll_interval,
            timeout=args.evaluation_timeout
        )
        
        # Save and display results
        output_path = Path(args.output_dir) / f"eval_results_{eval_model.replace('/', '_')}.zip"
        metrics = manager.save_evaluation_results(
            job_id=eval_job.id,
            output_path=str(output_path)
        )
        
        logger.info("=" * 50)
        logger.info("Evaluation Results:")
        for metric_name, value in metrics.items():
            logger.info(f"  {metric_name}: {value:.4f}")
        logger.info("=" * 50)
        
        return metrics
        
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        return {}


def run_comparison_phase(manager: NeMoMicroservicesManager, config: Dict, args: argparse.Namespace, custom_model: Optional[str] = None):
    """Run comparison between base and custom models"""
    
    if not args.compare or not custom_model:
        logger.info("Skipping comparison phase")
        return
    
    logger.info("=" * 50)
    logger.info("PHASE 5: Model Comparison")
    logger.info("=" * 50)
    
    try:
        # Evaluate base model
        logger.info("Evaluating base model...")
        base_metrics = run_evaluation_phase(manager, config, args, config['base_model'])
        
        # Evaluate custom model
        logger.info("Evaluating custom model...")
        custom_metrics = run_evaluation_phase(manager, config, args, custom_model)
        
        # Compare results
        logger.info("=" * 50)
        logger.info("Model Comparison Results:")
        logger.info("-" * 50)
        logger.info(f"Base Model: {config['base_model']}")
        for metric_name, value in base_metrics.items():
            logger.info(f"  {metric_name}: {value:.4f}")
        logger.info("-" * 50)
        logger.info(f"Custom Model: {custom_model}")
        for metric_name, value in custom_metrics.items():
            logger.info(f"  {metric_name}: {value:.4f}")
        logger.info("-" * 50)
        logger.info("Improvements:")
        for metric_name in base_metrics:
            if metric_name in custom_metrics:
                improvement = custom_metrics[metric_name] - base_metrics[metric_name]
                percentage = (improvement / base_metrics[metric_name] * 100) if base_metrics[metric_name] != 0 else 0
                logger.info(f"  {metric_name}: {improvement:+.4f} ({percentage:+.1f}%)")
        logger.info("=" * 50)
        
    except Exception as e:
        logger.error(f"Comparison failed: {e}")


def main():
    """Main entry point"""
    
    parser = argparse.ArgumentParser(description="NeMo Microservices End-to-End Pipeline")
    
    # Configuration arguments
    parser.add_argument("--config", type=str, help="Path to configuration JSON file")
    parser.add_argument("--nemo-url", type=str, help="NeMo services URL")
    parser.add_argument("--nim-url", type=str, help="NIM inference URL")
    parser.add_argument("--nds-url", type=str, help="Data Store URL")
    parser.add_argument("--namespace", type=str, help="Namespace for resources")
    parser.add_argument("--dataset-name", type=str, help="Name of the dataset")
    parser.add_argument("--base-model", type=str, help="Base model identifier")
    parser.add_argument("--project", type=str, help="Project name")
    
    # Phase control arguments
    parser.add_argument("--deploy", action="store_true", help="Run deployment phase")
    parser.add_argument("--prepare-dataset", action="store_true", help="Run dataset preparation phase")
    parser.add_argument("--customize", action="store_true", help="Run customization phase")
    parser.add_argument("--evaluate", action="store_true", help="Run evaluation phase")
    parser.add_argument("--compare", action="store_true", help="Compare base and custom models")
    parser.add_argument("--all", action="store_true", help="Run all phases")
    
    # Deployment arguments
    parser.add_argument("--gpu-count", type=int, default=1, help="Number of GPUs for deployment")
    parser.add_argument("--pvc-size", type=str, default="25Gi", help="PVC size for deployment")
    parser.add_argument("--deployment-timeout", type=int, default=600, help="Deployment timeout in seconds")
    
    # Dataset arguments
    parser.add_argument("--data-dir", type=str, default="data", help="Directory containing data files")
    
    # Customization arguments
    parser.add_argument("--epochs", type=int, default=2, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Training batch size")
    parser.add_argument("--learning-rate", type=float, default=0.0001, help="Learning rate")
    parser.add_argument("--lora-dim", type=int, default=16, help="LoRA adapter dimension")
    parser.add_argument("--lora-dropout", type=float, default=0.1, help="LoRA adapter dropout")
    parser.add_argument("--sequence-packing", action="store_true", help="Enable sequence packing")
    parser.add_argument("--model-version", type=str, default="1", help="Version for custom model")
    parser.add_argument("--customization-timeout", type=int, default=6000, help="Customization timeout in seconds")
    
    # Evaluation arguments
    parser.add_argument("--eval-model", type=str, help="Specific model to evaluate")
    parser.add_argument("--eval-samples", type=int, default=50, help="Number of samples to evaluate")
    parser.add_argument("--eval-parallelism", type=int, default=8, help="Evaluation parallelism")
    parser.add_argument("--eval-max-tokens", type=int, default=20, help="Max tokens for evaluation")
    parser.add_argument("--eval-temperature", type=float, default=0.7, help="Temperature for evaluation")
    parser.add_argument("--eval-top-p", type=float, default=0.9, help="Top-p for evaluation")
    parser.add_argument("--evaluation-timeout", type=int, default=600, help="Evaluation timeout in seconds")
    
    # General arguments
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory for results")
    parser.add_argument("--poll-interval", type=int, default=10, help="Polling interval in seconds")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # If --all is specified, enable all phases
    if args.all:
        args.deploy = True
        args.prepare_dataset = True
        args.customize = True
        args.evaluate = True
        args.compare = True
    
    # Load configuration
    config = load_config(args.config)
    
    # Override config with command-line arguments
    if args.nemo_url:
        config['nemo_url'] = args.nemo_url
    if args.nim_url:
        config['nim_url'] = args.nim_url
    if args.nds_url:
        config['nds_url'] = args.nds_url
    if args.namespace:
        config['namespace'] = args.namespace
    if args.dataset_name:
        config['dataset_name'] = args.dataset_name
    if args.base_model:
        config['base_model'] = args.base_model
    
    # Create output directory
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    
    # Initialize manager
    logger.info("Initializing NeMo Microservices Manager...")
    manager = NeMoMicroservicesManager(
        nemo_url=config['nemo_url'],
        nim_url=config['nim_url'],
        nds_url=config['nds_url'],
        nds_token=config.get('nds_token', 'token')
    )
    
    # Run pipeline phases
    success = True
    custom_model = None
    
    # Phase 1: Deployment
    if args.deploy:
        success = run_deployment_phase(manager, config, args)
        if not success and not args.all:
            logger.error("Deployment failed, stopping pipeline")
            return 1
    
    # Phase 2: Dataset Preparation
    if args.prepare_dataset and success:
        success = run_dataset_preparation_phase(manager, config, args)
        if not success and not args.all:
            logger.error("Dataset preparation failed, stopping pipeline")
            return 1
    
    # Phase 3: Customization
    if args.customize and success:
        custom_model = run_customization_phase(manager, config, args)
        if not custom_model and not args.all:
            logger.error("Customization failed, stopping pipeline")
            return 1
    
    # Phase 4: Evaluation
    if args.evaluate and success:
        metrics = run_evaluation_phase(manager, config, args, custom_model)
    
    # Phase 5: Comparison
    if args.compare and custom_model:
        run_comparison_phase(manager, config, args, custom_model)
    
    logger.info("=" * 50)
    logger.info("Pipeline completed successfully!")
    logger.info("=" * 50)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
