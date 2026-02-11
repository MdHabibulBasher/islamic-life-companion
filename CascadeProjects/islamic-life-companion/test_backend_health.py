#!/usr/bin/env python
"""Test the actual API endpoint"""
import subprocess
import time
import sys

# First, let's try to find and kill any existing python processes on port 8000
print("Checking existing processes...")

try:
    # Try to connect to the backend
    import urllib.request
    import urllib.error
    import json
    
    # Test health endpoint first
    try:
        response = urllib.request.urlopen('http://localhost:8000/health', timeout=2)
        print("✓ Backend is running on localhost:8000")
        data = json.loads(response.read())
        print(f"  Health: {data}")
    except urllib.error.URLError as e:
        print(f"✗ Backend not responding on localhost:8000: {e}")
        print("  Attempting to start backend...")
        
        # Start backend
        import os
        os.chdir(r'c:\Users\habib\CascadeProjects\islamic-life-companion\backend')
        backend_process = subprocess.Popen([sys.executable, 'main.py'], 
                                          stdout=subprocess.PIPE, 
                                          stderr=subprocess.PIPE)
        print(f"  Started backend process {backend_process.pid}")
        time.sleep(3)  # Wait for startup
        
        try:
            response = urllib.request.urlopen('http://localhost:8000/health', timeout=2)
            print("✓ Backend started successfully")
        except:
            print("✗ Backend failed to start")
            _, stderr = backend_process.communicate(timeout=1)
            print(f"  Error: {stderr.decode()}")

finally:
    print("Done")
