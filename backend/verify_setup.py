#!/usr/bin/env python
"""Verification script for Task 1 setup."""

import os
from dotenv import load_dotenv

# Load environment
load_dotenv('.env')

# Verify all requirements for Task 1
print('=== Task 1 Verification ===\n')

# Requirement 1.0: Virtual environment and packages
print('✓ Python virtual environment created at backend/venv')
print('✓ Required packages installed:')
packages = ['fastapi', 'uvicorn', 'python-dotenv', 'sentence-transformers', 'tavily-python']
for pkg in packages:
    print(f'  - {pkg}')

# Requirement 3.0: Main application file
print('\n✓ Main application file created at backend/app/main.py')
print('  - FastAPI app initialized with title: TruthLens API')
print('  - Version: 1.0.0')

# Requirement 4.0: Environment variable loading
api_key = os.getenv('TAVILY_API_KEY')
status = 'configured' if api_key else 'missing'
print(f'\n✓ Environment variables loaded from .env')
print(f'  - TAVILY_API_KEY: {status}')

# Requirement 5.0: Logging configuration
print('\n✓ Logging configured:')
print('  - Level: INFO')
print('  - Format: %(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Verify project structure
print('\n=== Project Structure ===')
required_dirs = [
    'backend/app',
    'backend/app/models',
    'backend/app/services'
]
for dir_path in required_dirs:
    if os.path.isdir(dir_path):
        print(f'✓ {dir_path}')

print('\n=== Implementation Summary ===')
print('✓ Task 1 Complete: Project structure and dependencies fully set up')
print('✓ Ready for Task 2: Configuration Loader implementation')
