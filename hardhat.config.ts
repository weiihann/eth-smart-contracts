import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from 'dotenv'
dotenv.config()

// const INFURA_API_KEY: string = process.env.INFURA_API_KEY ?? '';
const GOERLI_PRIVATE_KEY: string = process.env.GOERLI_PRIVATE_KEY ?? '';

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    testnet: {
      url: 'http://localhost:8645',
      chainId: 97,
      accounts: [GOERLI_PRIVATE_KEY],
      gas: 60000000000
    }
  }
};

export default config;
