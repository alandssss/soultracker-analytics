#!/usr/bin/env python3
"""
EDGE CASE TESTING FOR LIVE DURATION CALCULATION
Tests various edge cases that could cause live_duration_h calculation issues
"""

import requests
import tempfile
import os
from openpyxl import Workbook

# Get backend URL from frontend environment
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

print(f"🔍 EDGE CASE TESTING FOR LIVE DURATION CALCULATION")
print(f"Testing backend at: {API_BASE}")
print("=" * 80)

def create_edge_case_xlsx():
    """Create XLSX with various edge cases for live duration values"""
    print("\n=== CREATING EDGE CASE TEST FILE ===")
    
    try:
        wb = Workbook()
        ws = wb.active
        
        # Headers
        headers = [
            "Creator ID", "Creator's username", "Joined time", "Diamonds",
            "LIVE duration", "Valid go LIVE days", "manager", "Data period"
        ]
        for i, header in enumerate(headers, 1):
            ws.cell(row=1, column=i, value=header)
        
        # Edge case test data
        edge_cases = [
            # [creator_id, username, joined_time, diamonds, live_duration, valid_days, manager, period]
            ["EDGE001", "zero_duration", "2024-01-15", 50000, 0, 5, "TestManager", "EDGE_TEST"],
            ["EDGE002", "zero_float_duration", "2024-01-15", 50000, 0.0, 5, "TestManager", "EDGE_TEST"],
            ["EDGE003", "string_zero_duration", "2024-01-15", 50000, "0", 5, "TestManager", "EDGE_TEST"],
            ["EDGE004", "string_zero_float_duration", "2024-01-15", 50000, "0.0", 5, "TestManager", "EDGE_TEST"],
            ["EDGE005", "empty_string_duration", "2024-01-15", 50000, "", 5, "TestManager", "EDGE_TEST"],
            ["EDGE006", "none_duration", "2024-01-15", 50000, None, 5, "TestManager", "EDGE_TEST"],
            ["EDGE007", "invalid_string_duration", "2024-01-15", 50000, "invalid", 5, "TestManager", "EDGE_TEST"],
            ["EDGE008", "special_chars_duration", "2024-01-15", 50000, "N/A", 5, "TestManager", "EDGE_TEST"],
            ["EDGE009", "negative_duration", "2024-01-15", 50000, -5.5, 5, "TestManager", "EDGE_TEST"],
            ["EDGE010", "very_large_duration", "2024-01-15", 50000, 999999.99, 5, "TestManager", "EDGE_TEST"],
            ["EDGE011", "decimal_string_duration", "2024-01-15", 50000, "45.75", 5, "TestManager", "EDGE_TEST"],
            ["EDGE012", "comma_decimal_duration", "2024-01-15", 50000, "45,75", 5, "TestManager", "EDGE_TEST"],
            ["EDGE013", "scientific_notation", "2024-01-15", 50000, "1.5e2", 5, "TestManager", "EDGE_TEST"],
            ["EDGE014", "boolean_true", "2024-01-15", 50000, True, 5, "TestManager", "EDGE_TEST"],
            ["EDGE015", "boolean_false", "2024-01-15", 50000, False, 5, "TestManager", "EDGE_TEST"],
        ]
        
        for row_idx, row_data in enumerate(edge_cases, 2):
            for col_idx, value in enumerate(row_data, 1):
                ws.cell(row=row_idx, column=col_idx, value=value)
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
        wb.save(temp_file.name)
        
        print(f"✅ Created edge case test file with {len(edge_cases)} test cases")
        return temp_file.name, edge_cases
        
    except Exception as e:
        print(f"❌ Error creating edge case XLSX: {e}")
        return None, None

def test_edge_cases():
    """Test edge cases for live duration calculation"""
    print("\n=== TESTING EDGE CASES ===")
    
    # Create test file
    xlsx_file, test_cases = create_edge_case_xlsx()
    if not xlsx_file:
        print("❌ Cannot create edge case test file")
        return False
    
    try:
        # Upload the file
        with open(xlsx_file, 'rb') as f:
            files = {'file': ('edge_case_test.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            response = requests.post(f"{API_BASE}/upload-report", files=files)
        
        # Clean up temp file
        os.unlink(xlsx_file)
        
        print(f"Upload Status Code: {response.status_code}")
        print(f"Upload Response: {response.json()}")
        
        if response.status_code != 200:
            print(f"❌ Upload failed - Status: {response.status_code}")
            return False
        
        upload_data = response.json()
        if not upload_data.get("ok") or upload_data.get("processed", 0) == 0:
            print(f"❌ Upload processing failed: {upload_data}")
            return False
        
        print(f"✅ Upload successful - Processed: {upload_data['processed']} creators")
        
        # Get the uploaded creators
        response = requests.get(f"{API_BASE}/creators")
        if response.status_code != 200:
            print(f"❌ Failed to get creators - Status: {response.status_code}")
            return False
        
        creators_data = response.json()
        creators = creators_data.get("items", [])
        
        # Find our edge case creators
        edge_creators = {c.get("creator_id"): c for c in creators if c.get("creator_id", "").startswith("EDGE")}
        
        print(f"\n--- EDGE CASE RESULTS ---")
        all_passed = True
        
        for test_case in test_cases:
            creator_id = test_case[0]
            username = test_case[1]
            input_duration = test_case[4]
            
            if creator_id in edge_creators:
                creator = edge_creators[creator_id]
                actual_duration = creator.get("live_duration_h")
                
                # Determine expected value based on backend logic
                try:
                    if input_duration is None or input_duration == "":
                        expected = 0.0
                    elif isinstance(input_duration, bool):
                        expected = float(input_duration)  # True=1.0, False=0.0
                    elif isinstance(input_duration, str) and "," in input_duration:
                        expected = 0.0  # Comma decimal should fail conversion
                    else:
                        expected = float(input_duration)
                except (ValueError, TypeError):
                    expected = 0.0
                
                # Check if actual matches expected
                match = abs(float(actual_duration or 0) - expected) < 0.001
                status = "✅ PASS" if match else "❌ FAIL"
                
                print(f"{status} - {username} (ID: {creator_id})")
                print(f"  Input: {input_duration} ({type(input_duration)})")
                print(f"  Expected: {expected}")
                print(f"  Actual: {actual_duration}")
                
                if not match:
                    all_passed = False
                    print(f"  ⚠️  MISMATCH!")
                print()
            else:
                print(f"❌ MISSING - Creator {creator_id} ({username}) not found in database")
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Edge case testing error: {e}")
        if xlsx_file and os.path.exists(xlsx_file):
            os.unlink(xlsx_file)
        return False

def test_alternative_column_names():
    """Test different variations of LIVE duration column names"""
    print("\n=== TESTING ALTERNATIVE COLUMN NAMES ===")
    
    column_variations = [
        "LIVE duration",
        "LIVE duration(h)",
        "live duration",
        "live duration(h)",
        "Live Duration",
        "Live Duration(h)",
        "LIVE DURATION",
        "LIVE DURATION(H)",
    ]
    
    all_passed = True
    
    for col_name in column_variations:
        print(f"\nTesting column name: '{col_name}'")
        
        try:
            wb = Workbook()
            ws = wb.active
            
            # Headers with the variation
            headers = [
                "Creator ID", "Creator's username", "Joined time", "Diamonds",
                col_name, "Valid go LIVE days", "manager", "Data period"
            ]
            for i, header in enumerate(headers, 1):
                ws.cell(row=1, column=i, value=header)
            
            # Test data
            test_data = [f"COL{hash(col_name) % 10000}", f"test_{col_name.replace(' ', '_').lower()}", "2024-01-15", 50000, 42.5, 5, "TestManager", "COL_TEST"]
            for col_idx, value in enumerate(test_data, 1):
                ws.cell(row=2, column=col_idx, value=value)
            
            # Save and upload
            temp_file = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
            wb.save(temp_file.name)
            
            with open(temp_file.name, 'rb') as f:
                files = {'file': (f'column_test_{hash(col_name)}.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                response = requests.post(f"{API_BASE}/upload-report", files=files)
            
            os.unlink(temp_file.name)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") and data.get("processed", 0) > 0:
                    print(f"✅ PASSED - Column '{col_name}' recognized and processed")
                else:
                    print(f"❌ FAILED - Column '{col_name}' not processed correctly: {data}")
                    all_passed = False
            else:
                print(f"❌ FAILED - Column '{col_name}' caused upload error: {response.status_code}")
                all_passed = False
                
        except Exception as e:
            print(f"❌ FAILED - Error testing column '{col_name}': {e}")
            all_passed = False
    
    return all_passed

def run_comprehensive_edge_case_test():
    """Run comprehensive edge case testing"""
    print("🚀 STARTING COMPREHENSIVE EDGE CASE TESTING")
    print("=" * 80)
    
    # Test 1: Edge cases
    edge_case_result = test_edge_cases()
    
    # Test 2: Alternative column names
    column_name_result = test_alternative_column_names()
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 EDGE CASE TESTING SUMMARY")
    print("=" * 80)
    
    tests = [
        ("Edge Case Values", edge_case_result),
        ("Alternative Column Names", column_name_result),
    ]
    
    all_passed = True
    for test_name, result in tests:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    if all_passed:
        print("\n🎉 ALL EDGE CASE TESTS PASSED - live_duration_h calculation handles edge cases correctly!")
    else:
        print("\n⚠️  EDGE CASE ISSUES DETECTED - Some edge cases may cause problems!")
    
    return all_passed

if __name__ == "__main__":
    run_comprehensive_edge_case_test()