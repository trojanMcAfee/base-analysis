#!/usr/bin/env python3

import os
from web3 import Web3
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the RPC URL from environment variables
BASE_RPC_URL = os.getenv("BASE_RPC_URL")

# Define contract details
MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
MARKET_ID = "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836"
BLOCK_NUMBER = 27750945

# ABI for just the market function we need
ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "id",
                "type": "bytes32"
            }
        ],
        "name": "market",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "totalSupplyAssets",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "totalSupplyShares",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "totalBorrowAssets",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "totalBorrowShares",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "lastUpdate",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "fee",
                "type": "uint128"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

def main():
    # Connect to Base network
    w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
    
    # Check connection
    if not w3.is_connected():
        print("Failed to connect to Base network")
        return
    
    print(f"Connected to Base network. Current block: {w3.eth.block_number}")
    
    # Create contract instance
    morpho_contract = w3.eth.contract(address=MORPHO_ADDRESS, abi=ABI)
    
    # Query market data at specific block
    try:
        market_data = morpho_contract.functions.market(MARKET_ID).call(block_identifier=BLOCK_NUMBER)
        
        # Unpack the returned data
        (
            totalSupplyAssets, 
            totalSupplyShares, 
            totalBorrowAssets, 
            totalBorrowShares,
            lastUpdate,
            fee
        ) = market_data
        
        print("\n=== Market Data for cbBTC/USDC at block", BLOCK_NUMBER, "===")
        print(f"Total Supply Assets: {totalSupplyAssets}")
        print(f"Total Supply Shares: {totalSupplyShares}")
        print(f"Total Borrow Assets: {totalBorrowAssets}")
        print(f"Total Borrow Shares: {totalBorrowShares}")
        print(f"Last Update: {lastUpdate}")
        print(f"Fee: {fee}")
        
    except Exception as e:
        print(f"Error querying market data: {e}")

if __name__ == "__main__":
    main() 