#!/usr/bin/env python
"""Comprehensive backend diagnostics"""
import socket
import subprocess
import sys
import time
import os
from pathlib import Path

def is_port_open(host, port):
    """Check if a port is open"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, port))
    sock.close()
    return result == 0

def kill_process_on_port(port):
    """Kill any process using the specified port"""
    try:
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            shell=True
        )
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                pid = line.split()[-1]
                subprocess.run(['taskkill', '/PID', pid, '/F'], capture_output=True)
                return True
    except:
        pass
    return False

print("=== Backend Diagnostics ===\n")

# Check if port 8000 is open
print("1. Checking if port 8000 is in use...")
if is_port_open('127.0.0.1', 8000):
    print("   ✓ Port 8000 is in use (backend might be running)")
else:
    print("   ✗ Port 8000 is free (backend not running)")
    print("   → Attempting to start backend...")
    
    try:
        # Kill any existing processes first
        kill_process_on_port(8000)
        time.sleep(1)
        
        # Navigate to backend directory
        os.chdir(r'c:\Users\habib\CascadeProjects\islamic-life-companion\backend')
        
        # Start backend
        process = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for server to start
        print("   Waiting for server to start...")
        for i in range(10):
            time.sleep(1)
            if is_port_open('127.0.0.1', 8000):
                print("   ✓ Server started successfully!")
                break
        else:
            print("   ✗ Server failed to start")
            _, stderr = process.communicate(timeout=1)
            if stderr:
                print(f"   Error: {stderr[:200]}")
                
    except Exception as e:
        print(f"   ✗ Error: {e}")

# Check if backend is responding
print("\n2. Testing backend endpoints...")

import urllib.request
import urllib.error
import json

test_endpoints = [
    '/health',
    '/api/v1/challenges',
    '/api/v1/habits/statistics',
]

for endpoint in test_endpoints:
    try:
        response = urllib.request.urlopen(f'http://localhost:8000{endpoint}', timeout=2)
        content = response.read().decode()
        status = response.status
        # Try to parse as JSON
        try:
            data = json.loads(content)
            data_str = json.dumps(data)[:100]
        except:
            data_str = content[:100]
        print(f"   ✓ {endpoint}: {status} - {data_str}...")
    except urllib.error.URLError as e:
        print(f"   ✗ {endpoint}: Connection error - {e}")
    except urllib.error.HTTPError as e:
        print(f"   ✗ {endpoint}: HTTP {e.code}")
    except Exception as e:
        print(f"   ✗ {endpoint}: {e}")

print("\n✓ Diagnostics complete")
