import { ethers } from "hardhat";

async function main() {

  const [signer, signer1] = await ethers.getSigners();

  const SocialRecovery = await ethers.getContractFactory("SocialRecovery");
  const socialRecovery = await SocialRecovery.deploy(signer.address, signer1.address);

  await socialRecovery.deployed();

  console.log(
      `Social Recovery Addr = ${socialRecovery.address}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
