export default {
  'targetPath': './src/contracts',
  "chainId": 11155111,
  "package": {
    "name": "@dappql/test-app-contracts",
    "version": "0.0.1",
    "description": "ToDo demo contracts (Sepolia) packaged via dappql pack",
    "license": "MIT",
    "source": "./sdk-src",
    "main": "index.ts",
    "protocol": {
      "name": "DappQL ToDo Demo",
      "website": "https://todo.dappql.com",
      "docs": "https://dappql.com",
      "repo": "https://github.com/dappql/core",
      "explorer": "https://sepolia.etherscan.io"
    }
  },
  "contracts": {
    "ToDo": {
      "address": "0x29B63f08aBa4Be48873238C23693a5550bC1E93F",
      "abi": [
        {
          "type": "function",
          "name": "addItem",
          "stateMutability": "nonpayable",
          "inputs": [
            {
              "name": "_content",
              "type": "string"
            },
            {
              "name": "_status",
              "type": "uint256"
            }
          ],
          "outputs": [
            {
              "name": "",
              "type": "uint256"
            }
          ]
        },
        {
          "type": "function",
          "name": "updateItem",
          "stateMutability": "nonpayable",
          "inputs": [
            {
              "name": "_id",
              "type": "uint256"
            },
            {
              "name": "_content",
              "type": "string"
            },
            {
              "name": "_status",
              "type": "uint256"
            }
          ],
          "outputs": []
        },
        {
          "type": "function",
          "name": "updateStatus",
          "stateMutability": "nonpayable",
          "inputs": [
            {
              "name": "_id",
              "type": "uint256"
            },
            {
              "name": "_status",
              "type": "uint256"
            }
          ],
          "outputs": []
        },
        {
          "type": "function",
          "name": "numItems",
          "stateMutability": "view",
          "inputs": [
            {
              "name": "arg0",
              "type": "address"
            }
          ],
          "outputs": [
            {
              "name": "",
              "type": "uint256"
            }
          ]
        },
        {
          "type": "function",
          "name": "item",
          "stateMutability": "view",
          "inputs": [
            {
              "name": "arg0",
              "type": "address"
            },
            {
              "name": "arg1",
              "type": "uint256"
            }
          ],
          "outputs": [
            {
              "name": "",
              "type": "tuple",
              "components": [
                {
                  "name": "user",
                  "type": "address"
                },
                {
                  "name": "timestamp",
                  "type": "uint256"
                },
                {
                  "name": "content",
                  "type": "string"
                },
                {
                  "name": "status",
                  "type": "uint256"
                },
                {
                  "name": "lastUpdated",
                  "type": "uint256"
                }
              ]
            }
          ]
        }
      ]
    }
  }
}