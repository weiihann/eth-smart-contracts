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
let socialRecovery: any;
let owner: SignerWithAddress;
let guardian: SignerWithAddress;
let newOwner: SignerWithAddress;
let addr1: SignerWithAddress;
let addr2: SignerWithAddress;

describe("Social Recovery 4337 Wallet", function () {
  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await ethers.provider.listAccounts();
    [owner, guardian, newOwner, addr1, addr2] = await ethers.getSigners();
    entryPoint = await new EntryPoint__factory(owner).deploy();

    const SocialRecovery = await ethers.getContractFactory("SocialRecovery");
    socialRecovery = await SocialRecovery.deploy(
      entryPoint.address,
      owner.address
    );
  });

  describe("Constructor and initial state", function () {
    it("Should set the correct EntryPoint and owner", async function () {
      expect(await socialRecovery.entryPoint()).to.equal(entryPoint.address);
      expect(await socialRecovery.owner()).to.equal(owner.address);
    });
  });

  describe("Set guardian", function () {
    it("Should set the guardian correctly", async function () {
      await socialRecovery.connect(owner).setGuardian(guardian.address);
      expect(await socialRecovery.guardian()).to.equal(guardian.address);
    });

    it("Should revert if not owner", async function () {
      await expect(
        socialRecovery.connect(addr1).setGuardian(addr2.address)
      ).to.be.revertedWith("only owner");
    });
  });

  describe("Set recovery confirmation time", function () {
    it("Should set the recovery confirmation time correctly", async function () {
      const confirmationTime = 3600;
      await socialRecovery
        .connect(owner)
        .setRecoveryConfirmationTime(confirmationTime);
      expect(await socialRecovery.recoveryConfirmationTime()).to.equal(
        confirmationTime
      );
    });

    it("Should revert if not owner", async function () {
      await expect(
        socialRecovery.connect(addr1).setRecoveryConfirmationTime(3600)
      ).to.be.revertedWith("only owner");
    });
  });

  describe("Initiate recovery process", function () {
    it("Should initiate recovery process correctly", async function () {
      await socialRecovery.connect(owner).setGuardian(guardian.address);
      await socialRecovery.connect(guardian).initRecovery(newOwner.address);
      const recoveryRequest = await socialRecovery.recoveryRequest();
      expect(recoveryRequest.newOwner).to.equal(newOwner.address);
    });

    it("Should revert if not guardian", async function () {
      await expect(
        socialRecovery.connect(addr1).initRecovery(addr2.address)
      ).to.be.revertedWith("SocialRecovery: msg sender invalid");
    });
  });

  describe("Cancel recovery", function () {
    beforeEach(async function () {
      await socialRecovery.connect(owner).setGuardian(guardian.address);
      await socialRecovery.connect(guardian).initRecovery(newOwner.address);
    });

    it("Should cancel the recovery process correctly", async function () {
      await socialRecovery.connect(owner).cancelRecovery();
      const recoveryRequest = await socialRecovery.recoveryRequest();
      expect(recoveryRequest.newOwner).to.equal(ethers.constants.AddressZero);
    });

    it("Should revert if not owner", async function () {
      await expect(
        socialRecovery.connect(addr1).cancelRecovery()
      ).to.be.revertedWith("SocialRecovery: msg sender invalid");
    });

    it("Should revert if no recovery request", async function () {
      await socialRecovery.connect(owner).cancelRecovery();
      await expect(
        socialRecovery.connect(owner).cancelRecovery()
      ).to.be.revertedWith("SocialRecovery: request invalid");
    });
  });

  describe("Execute recovery", function () {
    beforeEach(async function () {
      await socialRecovery.connect(owner).setGuardian(guardian.address);
      await socialRecovery.connect(owner).setRecoveryConfirmationTime(1); // 1 second for testing purposes
      await socialRecovery.connect(guardian).initRecovery(newOwner.address);
    });

    it("Should execute the recovery process correctly", async function () {
      await time.increaseTo((await time.latest()) + 2);
      await socialRecovery.connect(owner).executeRecovery();
      expect(await socialRecovery.owner()).to.equal(newOwner.address);
    });

    it("Should revert if not owner or guardian", async function () {
      await expect(
        socialRecovery.connect(addr1).executeRecovery()
      ).to.be.revertedWith("SocialRecovery: msg sender invalid");
    });

    it("Should revert if recovery confirmation time not passed", async function () {
      await expect(
        socialRecovery.connect(owner).executeRecovery()
      ).to.be.revertedWith(
        "SocialRecovery: recovery confirmation time not passed"
      );
    });
  });

  describe("isValidSignature", function () {
    it("Should return the correct interface ID if the signature is valid", async function () {
      const message = "Hello, socialRecovery!";
      const messageHash = ethers.utils.hashMessage(message);
      const signature = await owner.signMessage(message);

      expect(
        await socialRecovery.isValidSignature(messageHash, signature)
      ).to.equal(
        ethers.utils
          .solidityKeccak256(["string"], ["isValidSignature(bytes32,bytes)"])
          .slice(0, 10)
      );
    });

    it("Should return 0xffffffff if the signature is invalid", async function () {
      const message = "Hello, socialRecovery!";
      const messageHash = ethers.utils.hashMessage(message);
      const signature = await addr1.signMessage(message);

      expect(
        await socialRecovery.isValidSignature(messageHash, signature)
      ).to.equal("0xffffffff");
    });
  });

  it("owner should be able to call transfer", async () => {
    const { proxy: account } = await createSocialRecoveryAccount(
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
    const { proxy: account } = await createSocialRecoveryAccount(
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

  describe("#validateUserOp", () => {
    const actualGasPrice = 1e9;
    let account: SocialRecovery | SimpleAccount;
    let walletAddressBeforeCreate: string;
    let userOp: UserOperation;
    let userOpHash: string;
    let preBalance: number;
    let expectedPay: number;

    before(async () => {
      // that's the account of ethersSigner
      const accounts = await ethers.provider.listAccounts();
      const entryPoint = accounts[2];
      const accountOwner: any = createAccountOwner();
      const [signer] = await ethers.getSigners();
      ({ proxy: account, walletAddressBeforeCreate } =
        await createSocialRecoveryAccount(
          await ethers.getSigner(entryPoint),
          accountOwner.address,
          entryPoint
        ));

      // getAddress should return same address
      await expect(walletAddressBeforeCreate).to.be.equal(account.address);

      await signer.sendTransaction({
        from: accounts[0],
        to: account.address,
        value: parseEther("0.2"),
      });
      const callGasLimit = 200000;
      const verificationGasLimit = 100000;
      const maxFeePerGas = 3e9;
      const chainId = await ethers.provider
        .getNetwork()
        .then((net) => net.chainId);

      userOp = signUserOp(
        fillUserOpDefaults({
          sender: account.address,
          callGasLimit,
          verificationGasLimit,
          maxFeePerGas,
        }),
        accountOwner,
        entryPoint,
        chainId
      );

      userOpHash = await getUserOpHash(userOp, entryPoint, chainId);

      expectedPay = actualGasPrice * (callGasLimit + verificationGasLimit);

      preBalance = await getBalance(account.address);
      const ret = await account.validateUserOp(
        userOp,
        userOpHash,
        expectedPay,
        { gasPrice: actualGasPrice }
      );
      await ret.wait();
    });

    it("should pay", async () => {
      const postBalance = await getBalance(account.address);
      expect(preBalance - postBalance).to.eql(expectedPay);
    });

    it("should increment nonce", async () => {
      expect(await account.nonce()).to.equal(1);
    });

    it("should reject same TX on nonce error", async () => {
      await expect(
        account.validateUserOp(userOp, userOpHash, 0)
      ).to.revertedWith("account: invalid nonce");
    });

    it("should return NO_SIG_VALIDATION on wrong signature", async () => {
      const HashZero =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      const userOpHash = HashZero;
      const deadline = await account.callStatic.validateUserOp(
        { ...userOp, nonce: 1 },
        userOpHash,
        0
      );
      expect(deadline).to.eq(1);
    });
  });
});
