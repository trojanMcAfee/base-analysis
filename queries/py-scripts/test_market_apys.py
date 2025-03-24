#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

MORPHO_GRAPHQL_ENDPOINT = 'https://blue-api.morpho.org/graphql'
CBBTC_USDC_KEY = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836'  # cbBTC/USDC market

def make_query(unique_key, days=30):
    # Calculate timestamp for X days ago
    start_timestamp = int((datetime.now() - timedelta(days=days)).timestamp())
    
    print(f"Using market key: {unique_key}")
    print(f"Start timestamp: {start_timestamp} ({datetime.fromtimestamp(start_timestamp)})")
    
    # Query with minimal fields
    query = """
    query {
      marketAverageApys(
        uniqueKey: "%s"
        startTimestamp: %d
      ) {
        supplyApy
        borrowApy
      }
    }
    """ % (unique_key, start_timestamp)
    
    try:
        response = requests.post(
            MORPHO_GRAPHQL_ENDPOINT,
            json={'query': query},
            headers={'Content-Type': 'application/json'}
        )
        
        print("Response status:", response.status_code)
        
        # Print raw response
        print("\nRaw Response:")
        print(json.dumps(response.json(), indent=2))
        
    except Exception as e:
        print("Error:", e)

def get_market_ids():
    # Query to get list of market IDs
    query = """
    query {
      markets {
        items {
          id
          uniqueKey
          loanAsset {
            symbol
          }
          collateralAsset {
            symbol
          }
        }
      }
    }
    """
    
    try:
        response = requests.post(
            MORPHO_GRAPHQL_ENDPOINT,
            json={'query': query},
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json().get('data', {})
            if data and 'markets' in data and 'items' in data['markets']:
                print("\nAvailable Markets:")
                for market in data['markets']['items']:
                    loan = market.get('loanAsset', {}).get('symbol', 'Unknown')
                    collateral = market.get('collateralAsset', {}).get('symbol', 'Unknown')
                    print(f"ID: {market['id']}")
                    print(f"Key: {market.get('uniqueKey', 'N/A')}")
                    print(f"Assets: {collateral}/{loan}")
                    print("-" * 40)
                
                return data['markets']['items']
        
    except Exception as e:
        print("Error fetching markets:", e)
    
    return []

if __name__ == "__main__":
    # First get available markets
    markets = get_market_ids()
    
    # Try our known cbBTC/USDC market first with different timeframes
    print("\n=== Testing cbBTC/USDC market with 30-day timeframe ===")
    make_query(CBBTC_USDC_KEY, days=30)
    
    print("\n=== Testing cbBTC/USDC market with 7-day timeframe ===")
    make_query(CBBTC_USDC_KEY, days=7)
    
    # Try with one other market from the list if available
    if markets and len(markets) > 0:
        other_market = next((m for m in markets if m.get('uniqueKey') != CBBTC_USDC_KEY), None)
        if other_market:
            print(f"\n=== Testing {other_market.get('loanAsset', {}).get('symbol', 'Unknown')} market ===")
            make_query(other_market.get('uniqueKey'), days=7) 