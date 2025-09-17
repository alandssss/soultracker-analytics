#!/usr/bin/env python3
"""
Specific test for FormData filename property fix
Tests the React Native FormData issue where 'filename' property is required for FastAPI file validation
"""

import requests
import tempfile
import os
from openpyxl import Workbook

def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
    return "https://nginx-stack-update.preview.emergentagent.com"

BASE_URL = get_backend_url()
API_BASE = f"{BASE_URL}/api"

def create_test_xlsx():
    """Create a test XLSX file"""
    wb = Workbook()
    ws = wb.active
    
    # Headers
    headers = [
        "Creator ID", "Creator's username", "Joined time", "Diamonds",
        "LIVE duration", "Valid go LIVE days", "manager", "Data period"
    ]
    for i, header in enumerate(headers, 1):
        ws.cell(row=1, column=i, value=header)
    
    # Sample data
    sample_data = [
        ["99001", "test_creator_alpha", "2024-01-15", 85000, 50.5, 10, "TestManager", "10_2025"],
        ["99002", "test_creator_beta", "2024-02-20", 150000, 70.2, 25, "TestManager", "10_2025"],
    ]
    
    for row_idx, row_data in enumerate(sample_data, 2):
        for col_idx, value in enumerate(row_data, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)
    
    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    wb.save(temp_file.name)
    return temp_file.name

def test_formdata_with_filename():
    """Test FormData with filename property (React Native style)"""
    print("\n=== Test: FormData with filename property ===")
    
    xlsx_file = create_test_xlsx()
    try:
        with open(xlsx_file, 'rb') as f:
            # Simulate React Native FormData with filename property
            files = {
                'file': ('test_report.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            }
            response = requests.post(f"{API_BASE}/upload-report", files=files)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") is True and data.get("processed", 0) > 0:
                print("✅ FormData with filename PASSED")
                return True
            else:
                print(f"❌ FormData with filename FAILED - Unexpected response: {data}")
                return False
        else:
            print(f"❌ FormData with filename FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FormData with filename FAILED - Error: {e}")
        return False
    finally:
        if os.path.exists(xlsx_file):
            os.unlink(xlsx_file)

def test_invalid_file_type():
    """Test error handling for invalid file types"""
    print("\n=== Test: Invalid file type handling ===")
    
    # Create a text file instead of XLSX
    temp_file = tempfile.NamedTemporaryFile(suffix='.txt', delete=False)
    temp_file.write(b"This is not an XLSX file")
    temp_file.close()
    
    try:
        with open(temp_file.name, 'rb') as f:
            files = {
                'file': ('invalid_file.txt', f, 'text/plain')
            }
            response = requests.post(f"{API_BASE}/upload-report", files=files)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 400:
            data = response.json()
            if "Only .xlsx files are supported" in data.get("detail", ""):
                print("✅ Invalid file type handling PASSED")
                return True
            else:
                print(f"❌ Invalid file type handling FAILED - Unexpected error message: {data}")
                return False
        else:
            print(f"❌ Invalid file type handling FAILED - Expected 400, got: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Invalid file type handling FAILED - Error: {e}")
        return False
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

def test_missing_filename():
    """Test what happens when filename is missing (should still work with requests)"""
    print("\n=== Test: Missing filename in FormData ===")
    
    xlsx_file = create_test_xlsx()
    try:
        with open(xlsx_file, 'rb') as f:
            # Test without explicit filename (requests library behavior)
            files = {'file': f}
            response = requests.post(f"{API_BASE}/upload-report", files=files)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # This might fail because requests doesn't provide filename by default
        if response.status_code == 400:
            print("✅ Missing filename properly rejected (expected behavior)")
            return True
        elif response.status_code == 200:
            print("✅ Missing filename handled gracefully")
            return True
        else:
            print(f"❌ Missing filename test - Unexpected status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Missing filename test FAILED - Error: {e}")
        return False
    finally:
        if os.path.exists(xlsx_file):
            os.unlink(xlsx_file)

def run_formdata_tests():
    """Run all FormData-specific tests"""
    print("🔧 Testing FormData filename property fix")
    print(f"Target URL: {API_BASE}")
    print("=" * 60)
    
    tests = [
        ("FormData with filename", test_formdata_with_filename),
        ("Invalid file type handling", test_invalid_file_type),
        ("Missing filename handling", test_missing_filename),
    ]
    
    results = {}
    for test_name, test_func in tests:
        results[test_name] = test_func()
    
    print("\n" + "=" * 60)
    print("📊 FORMDATA FIX TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(tests)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    return results

if __name__ == "__main__":
    run_formdata_tests()