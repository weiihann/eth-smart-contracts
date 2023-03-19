import { ethers } from "hardhat";
import { createSocialRecoveryAccount } from "../test/helpers";

async function main() {
  const [signer] = await ethers.getSigners();
  const entryPointAddr = "0x0576a174D229E3cFA37253523E645A78A0C91B57"

  const { proxy: account, accountFactory } = await createSocialRecoveryAccount(
    signer,
    signer.address,
    entryPointAddr
  );

  console.log("Social Recovery Addr", account.address)
  console.log("EntryPoint Addr", entryPointAddr)
  console.log("Factory Addr", accountFactory.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
