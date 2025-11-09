import json
import csv
import os

def handler(event, context):
    """Basic Netlify function using only built-in modules"""
    
    # Get HTTP method and path
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '')
    
    try:
        # Machines endpoint
        if '/machines' in path:
            machines_data = []
            try:
                csv_path = os.path.join(os.path.dirname(__file__), 'data', 'data_mesin.csv')
                if os.path.exists(csv_path):
                    with open(csv_path, 'r', encoding='utf-8') as file:
                        reader = csv.DictReader(file)
                        machines_data = list(reader)
                        # Convert empty strings to None for better frontend handling
                        for machine in machines_data:
                            for key, value in machine.items():
                                if value == '':
                                    machine[key] = None
            except Exception as e:
                print(f"CSV read error: {e}")
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Failed to read machine data: {str(e)}'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(machines_data)
            }
            
        # Engineers endpoint
        elif '/engineers' in path:
            engineers_data = []
            try:
                csv_path = os.path.join(os.path.dirname(__file__), 'data', 'data_ce.csv')
                if os.path.exists(csv_path):
                    with open(csv_path, 'r', encoding='utf-8') as file:
                        reader = csv.DictReader(file)
                        engineers_data = list(reader)
                        # Convert empty strings to None
                        for engineer in engineers_data:
                            for key, value in engineer.items():
                                if value == '':
                                    engineer[key] = None
            except Exception as e:
                print(f"CSV read error: {e}")
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Failed to read engineer data: {str(e)}'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(engineers_data)
            }
            
        # Stock parts endpoint
        elif '/stock-parts' in path:
            stock_data = []
            try:
                csv_path = os.path.join(os.path.dirname(__file__), 'data', 'stok_part.csv')
                if os.path.exists(csv_path):
                    with open(csv_path, 'r', encoding='utf-8') as file:
                        reader = csv.DictReader(file)
                        stock_data = list(reader)
                        for item in stock_data:
                            for key, value in item.items():
                                if value == '':
                                    item[key] = None
            except Exception as e:
                print(f"CSV read error: {e}")
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Failed to read stock data: {str(e)}'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(stock_data)
            }
            
        # FSL locations endpoint
        elif '/fsl-locations' in path:
            fsl_data = []
            try:
                csv_path = os.path.join(os.path.dirname(__file__), 'data', 'alamat_fsl.csv')
                if os.path.exists(csv_path):
                    with open(csv_path, 'r', encoding='utf-8') as file:
                        reader = csv.DictReader(file)
                        fsl_data = list(reader)
                        for item in fsl_data:
                            for key, value in item.items():
                                if value == '':
                                    item[key] = None
            except Exception as e:
                print(f"CSV read error: {e}")
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Failed to read FSL data: {str(e)}'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(fsl_data)
            }
            
        # Monthly machines endpoint
        elif '/monthly-machines' in path:
            monthly_data = []
            try:
                csv_path = os.path.join(os.path.dirname(__file__), 'data', 'data_mesin_perbulan.csv')
                if os.path.exists(csv_path):
                    with open(csv_path, 'r', encoding='utf-8') as file:
                        reader = csv.DictReader(file)
                        monthly_data = list(reader)
                        for item in monthly_data:
                            for key, value in item.items():
                                if value == '':
                                    item[key] = None
            except Exception as e:
                print(f"CSV read error: {e}")
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Failed to read monthly data: {str(e)}'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(monthly_data)
            }
            
        else:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'message': 'ROC Dashboard API',
                    'version': '1.0.0',
                    'available_endpoints': [
                        '/api/machines',
                        '/api/engineers', 
                        '/api/stock-parts',
                        '/api/fsl-locations',
                        '/api/monthly-machines'
                    ]
                })
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }
