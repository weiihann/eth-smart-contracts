import { MyToken } from './../typechain-types/contracts/Token.sol/MyToken';
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
import { createAccountOwner, createSocialRecoveryAccount, createSpendLimitAccount, getBalance } from "./helpers";
import { parseEther } from "ethers/lib/utils";
import { SocialRecovery } from "../typechain-types";
import { UserOperation, fillUserOpDefaults, getUserOpHash, signUserOp } from "./helpers/UserOps";
import { BigNumber } from "ethers";

let provider: JsonRpcProvider;
let accounts: string[];
let entryPoint: EntryPoint;
let token: MyToken;
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
      spendLimit = await SpendLimit.deploy(
        entryPoint.address,
        owner.address
      );

    });

    it("should set and update a spending limit", async function () {
        // Set a spending limit for the token
        const amount = 1000;
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
        expect(updatedLimit.resetTime).to.be.at.least(Math.floor(Date.now() / 1000));
        expect(updatedLimit.isEnabled).to.equal(true);
    })

  it("should remove a spending limit for a token", async function () {
        // Set a spending limit for the token
        const amount = 1000;
        await spendLimit.setSpendingLimit(amount);
    
        // Remove the spending limit for the token
        await spendLimit.removeSpendingLimit();
    
        // Check that the spending limit was removed correctly
        const limit = await spendLimit.getLimitInfo();
        expect(limit.limit).to.equal(0);
        expect(limit.available).to.equal(0);
        expect(limit.resetTime).to.equal(0);
        expect(limit.isEnabled).to.equal(false);
    })

    it("should revert if the amount is zero", async function () {
        const zeroLimit = ethers.utils.parseEther("0");
        await expect(spendLimit.setSpendingLimit(zeroLimit)).to.be.revertedWith("Invalid amount");
    });

    it("owner should be able to call transfer", async () => {
        const { proxy: account } = await createSpendLimitAccount(
          ethers.provider.getSigner(),
          owner.address,
          entryPoint.address
        );
        // await  ethers.provider.getSigner().sendTransaction({
        //   from: owner.address,
        //   to: account.address,
        //   value: parseEther("2"),
        // });
        // await account.execute(addr1.address, parseEther("1"), "0x");
      });
    
    // it("other account should not be able to call transfer", async () => {
    // const { proxy: account } = await createSpendLimitAccount(
    //     ethers.provider.getSigner(),
    //     owner.address,
    //     entryPoint.address
    // );
    // await expect(
    //     account
    //     .connect(ethers.provider.getSigner(3))
    //     .execute(addr1.address, parseEther("1"), "0x")
    // ).to.be.revertedWith("account: not Owner or EntryPoint");
    // });

    // it("should allow the transaction if the spending limit is not enabled", async function () {
    //     const amount = ethers.utils.parseEther("1");

    //     const tx = await walletContract.execute(
    //         addr1.address,
    //         token.address,
    //         amount,
    //         [],
    //         [addr1.address],
    //         0
    //     );

    //     expect(tx).to.exist;
    // });
  
    //   it("should allow the transaction if the remaining available amount is greater than the amount to be spent", async function () {
    //     const amount = ethers.utils.parseEther("1");
  
    //     // enable spending limit with a daily limit of 1 token
    //     await spendLimitContract.setSpendingLimit(token.address, amount);
  
    //     // spend 0.5 token
    //     await walletContract.execute(
    //       user1Address,
    //       token.address,
    //       ethers.utils.parseEther("0.5"),
    //       [],
    //       [spendLimitContract.address],
    //       0
    //     );
  
    //     // try to spend 0.6 token (exceeding the remaining available amount of 0.5 token)
    //     await expect(
    //       walletContract.execute(user1Address, token.address, ethers.utils.parseEther("0.6"), [], [spendLimitContract.address], 0)
    //     ).to.be.reverted
})
  

//   it("should revert if the amount exceeds the remaining available amount", async function () {
//     const [owner, user] = await ethers.getSigners();
//     const token = await deployToken();
//     const entryPoint = await deployEntryPoint();
//     const spendLimit = await deploySpendLimit(entryPoint.address, owner.address);
  
//     // Set a spending limit for the token
//     const amount = 1000;
//     await spendLimit.setSpendingLimit(token.address, amount);
  
//     // Check that _checkSpendingLimit function reverts if the amount exceeds
  
  
