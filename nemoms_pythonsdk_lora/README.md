Preinstall steps:
1. Ensure Nemo Microservices setup script is up and runnig
2. Create virtual python env:
    ```
    python3 -m venv venv
    . venv/bin/activate
    pip install -r requirements.txt
    ```
3. If you want to add the venv to a Jupyter notebook:

```
# inside your venv
pip install ipykernel
python -m ipykernel install --user --name=venv --display-name "Python (venv)"
```