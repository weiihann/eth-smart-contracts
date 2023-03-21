import {
  EntryPoint,
  EntryPoint__factory,
  SimpleAccount,
} from "@account-abstraction/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  createAccountOwner,
  createSocialRecoveryAccount,
  createSpendLimitAccount,
  getBalance,
} from "./helpers";
import { parseEther } from "ethers/lib/utils";
import { SocialRecovery } from "../typechain-types";
import {
  UserOperation,
  fillUserOpDefaults,
  getUserOpHash,
  signUserOp,
} from "./helpers/UserOps";
import { BigNumber } from "ethers";

let provider: JsonRpcProvider;
let accounts: string[];
let entryPoint: EntryPoint;
let spendLimit: any;
let owner: SignerWithAddress;
let guardian: SignerWithAddress;
let newOwner: SignerWithAddress;
let addr1: SignerWithAddress;
let addr2: SignerWithAddress;

describe("SpendLimit 4337 Wallet", function () {
  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await ethers.provider.listAccounts();
    [owner, guardian, newOwner, addr1, addr2] = await ethers.getSigners();
    entryPoint = await new EntryPoint__factory(owner).deploy();

    const SpendLimit = await ethers.getContractFactory("SpendLimit");
    spendLimit = await SpendLimit.deploy(entryPoint.address, owner.address);
  });

  it("should set and update a spending limit", async function () {
    // Set a spending limit for the token
    const amount = 1000;
    await spendLimit.enableSpendLimit();
    await spendLimit.setSpendingLimit(amount);

    // Check that the spending limit was set correctly
    const limit = await spendLimit.getLimitInfo();
    expect(limit.limit).to.equal(amount);
    expect(limit.available).to.equal(amount);
    expect(limit.resetTime).to.be.at.least(Math.floor(Date.now() / 1000));
    expect(limit.isEnabled).to.equal(true);

    await time.increaseTo((await time.latest()) + 61);
    const newLimit = await spendLimit.getLimitInfo();
    expect(newLimit.available).to.equal(amount);
    expect(newLimit.resetTime).to.be.at.least(Math.floor(Date.now() / 1000));

    // Set a new spending limit for the token
    const newAmount = 500;
    await spendLimit.setSpendingLimit(newAmount);

    // Check that the spending limit was updated correctly
    const updatedLimit = await spendLimit.getLimitInfo();
    expect(updatedLimit.limit).to.equal(newAmount);
    expect(updatedLimit.available).to.equal(newAmount);
    expect(updatedLimit.resetTime).to.be.at.least(
      Math.floor(Date.now() / 1000)
    );
    expect(updatedLimit.isEnabled).to.equal(true);
  });

  it("should remove a spending limit for a token", async function () {
    // Set a spending limit for the token
    const amount = 1000;
    await spendLimit.enableSpendLimit();
    await spendLimit.setSpendingLimit(amount);

    // Remove the spending limit for the token
    await spendLimit.removeSpendingLimit();

    // Check that the spending limit was removed correctly
    const limit = await spendLimit.getLimitInfo();
    expect(limit.limit).to.equal(0);
    expect(limit.available).to.equal(0);
    expect(limit.resetTime).to.equal(0);
    expect(limit.isEnabled).to.equal(false);
  });

  it("should revert if the amount is zero", async function () {
    const zeroLimit = ethers.utils.parseEther("0");
    await spendLimit.enableSpendLimit();
    await expect(spendLimit.setSpendingLimit(zeroLimit)).to.be.revertedWith(
      "Invalid amount"
    );
  });

  it("owner should be able to call transfer if the spending limit is not enabled", async () => {
    const { proxy: account } = await createSpendLimitAccount(
      ethers.provider.getSigner(),
      owner.address,
      entryPoint.address
    );
    await ethers.provider.getSigner().sendTransaction({
      from: owner.address,
      to: account.address,
      value: parseEther("2"),
    });
    await account.execute(addr1.address, parseEther("1"), "0x");
  });

  it("other account should not be able to call transfer", async () => {
    const { proxy: account } = await createSpendLimitAccount(
      ethers.provider.getSigner(),
      owner.address,
      entryPoint.address
    );
    await expect(
      account
        .connect(ethers.provider.getSigner(3))
        .execute(addr1.address, parseEther("1"), "0x")
    ).to.be.revertedWith("account: not Owner or EntryPoint");
  });

  it("owner should be able to call transfer if its within the spending limit", async () => {
    const { proxy: account } = await createSpendLimitAccount(
      ethers.provider.getSigner(),
      owner.address,
      entryPoint.address
    );
    const amount = parseEther("0.2");
    await account.enableSpendLimit();
    await account.setSpendingLimit(amount);

    await ethers.provider.getSigner().sendTransaction({
      from: owner.address,
      to: account.address,
      value: parseEther("0.2"),
    });
    await account.execute(addr1.address, parseEther("0.2"), "0x");
  });

  it("owner should nor able to call transfer if its outside the spending limit", async () => {
    const { proxy: account } = await createSpendLimitAccount(
      ethers.provider.getSigner(),
      owner.address,
      entryPoint.address
    );
    const amount = parseEther("0.2");
    await account.enableSpendLimit();
    await account.setSpendingLimit(amount);

    await ethers.provider.getSigner().sendTransaction({
      from: owner.address,
      to: account.address,
      value: parseEther("0.22"),
    });

    // Max is 0.2 ETH
    try {
      await account.execute(addr1.address, parseEther("0.15"), "0x");
    } catch (e) {
      console.log(e);
    }

    // Max is 0.2 ETH, should revert as exceed max
    await expect(
      account.execute(addr1.address, parseEther("0.1"), "0x")
    ).to.be.revertedWith("Exceed daily limit");
  });
});
