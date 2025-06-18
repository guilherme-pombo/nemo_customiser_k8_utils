export HF_ENDPOINT="http://data-store.test/v1/hf"
export HF_TOKEN="dummy-unused-value"

huggingface-cli repo create sample-basic-test --type dataset
huggingface-cli upload --repo-type dataset default/sample-basic-test ~/tmp/sample_test_data
