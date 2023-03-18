import {
  SimpleAccount,
  SimpleAccountFactory,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
} from "@account-abstraction/contracts";
import { BigNumber, Signer, Wallet } from "ethers";
import { arrayify, keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";

export async function createAccount(
  ethersSigner: Signer,
  accountOwner: string,
  entryPoint: string,
  _factory?: SimpleAccountFactory
): Promise<{
  proxy: SimpleAccount;
  accountFactory: SimpleAccountFactory;
  implementation: string;
}> {
  const accountFactory =
    _factory ??
    (await new SimpleAccountFactory__factory(ethersSigner).deploy(entryPoint));
  const implementation = await accountFactory.accountImplementation();
  await accountFactory.createAccount(accountOwner, 0);
  const accountAddress = await accountFactory.getAddress(accountOwner, 0);
  const proxy = SimpleAccount__factory.connect(accountAddress, ethersSigner);
  return {
    implementation,
    accountFactory,
    proxy,
  };
}

// create non-random account, so gas calculations are deterministic
export function createAccountOwner(): Wallet {
  let counter = 0;
  const privateKey = keccak256(
    Buffer.from(arrayify(BigNumber.from(++counter)))
  );
  return new ethers.Wallet(privateKey, ethers.provider);
  // return new ethers.Wallet('0x'.padEnd(66, privkeyBase), ethers.provider);
}

export async function getBalance(address: string): Promise<number> {
  const balance = await ethers.provider.getBalance(address);
  return parseInt(balance.toString());
}
