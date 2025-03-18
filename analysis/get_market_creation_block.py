#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# Define the GraphQL API endpoint
GRAPHQL_URL = "https://blue-api.morpho.org/graphql"

# The marketId of the cbBTC/USDC market
MARKET_ID = "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836"

def get_market_creation_block():
    """
    Query the Morpho GraphQL API to get the creation block number of the cbBTC/USDC market.
    """
    query = """
    {
      marketByUniqueKey(
        uniqueKey: "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836"
        chainId: 8453
      ) {
        id
        uniqueKey
        creationBlockNumber
        creationTimestamp
        collateralAsset {
          symbol
        }
        loanAsset {
          symbol
        }
      }
    }
    """
    
    print("Querying Morpho API for cbBTC/USDC market creation information...")
    
    try:
        response = requests.post(
            GRAPHQL_URL,
            json={"query": query}
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if "errors" in data:
                print("API Error:", json.dumps(data["errors"], indent=2))
                return None
            
            if "data" in data and "marketByUniqueKey" in data["data"] and data["data"]["marketByUniqueKey"]:
                market = data["data"]["marketByUniqueKey"]
                creation_block = market.get("creationBlockNumber")
                creation_timestamp = market.get("creationTimestamp")
                
                # Format the timestamp as a readable date
                if creation_timestamp:
                    creation_date = datetime.fromtimestamp(int(creation_timestamp))
                    date_str = creation_date.strftime("%Y-%m-%d %H:%M:%S")
                else:
                    date_str = "Unknown"
                
                print("\n" + "="*60)
                print(f"cbBTC/USDC Market Creation Information")
                print("="*60)
                print(f"Market ID: {market.get('id')}")
                print(f"Collateral Asset: {market.get('collateralAsset', {}).get('symbol')}")
                print(f"Loan Asset: {market.get('loanAsset', {}).get('symbol')}")
                print(f"Creation Block Number: {creation_block}")
                print(f"Creation Date: {date_str}")
                print("="*60)
                
                return creation_block
            else:
                print("Market data not found in the response")
                return None
        else:
            print(f"Error: API request failed with status {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None

if __name__ == "__main__":
    creation_block = get_market_creation_block()
    
    if creation_block:
        print(f"\nThe cbBTC/USDC market was created at block number {creation_block} on the Base blockchain.")
    else:
        print("\nFailed to retrieve the creation block number for the cbBTC/USDC market.") 