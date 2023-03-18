import {
  EntryPoint__factory,
  SimpleAccount,
  SimpleAccount__factory,
} from "@account-abstraction/contracts";
import { expect } from "chai";
import { ethers } from "hardhat";
import { createAccount, createAccountOwner, getBalance } from "./helpers";
import { parseEther } from "ethers/lib/utils";
import {
  UserOperation,
  fillUserOpDefaults,
  getUserOpHash,
  signUserOp,
} from "./helpers/UserOps";

const ONE_ETH = parseEther("1");

describe("4337 Wallet", function () {
  async function fixture() {
    const provider = ethers.provider;
    const accounts = await ethers.provider.listAccounts();
    const [signer] = await ethers.getSigners();
    const beneficiary = await signer.getAddress();
    const entryPoint = await new EntryPoint__factory(signer).deploy();

    const sampleRecipient = await new SimpleAccount__factory(signer).deploy(
      entryPoint.address
    );

    return {
      provider,
      signer,
      accounts,
      walletOwner: accounts[0],
      account2: accounts[1],
      beneficiary,
      entryPoint,
      sampleRecipient,
    };
  }

  it("owner should be able to call transfer", async () => {
    const {
      provider,
      signer,
      walletOwner,
      entryPoint,
      account2,
      sampleRecipient,
    } = await fixture();

    const { proxy: account } = await createAccount(
      ethers.provider.getSigner(),
      walletOwner,
      entryPoint.address
    );
    await signer.sendTransaction({
      from: walletOwner,
      to: account.address,
      value: parseEther("2"),
    });
    await account.execute(account2, ONE_ETH, "0x");
  });

  it("other account should not be able to call transfer", async () => {
    const { walletOwner, entryPoint, account2 } = await fixture();

    const { proxy: account } = await createAccount(
      ethers.provider.getSigner(),
      walletOwner,
      entryPoint.address
    );
    await expect(
      account
        .connect(ethers.provider.getSigner(3))
        .execute(account2, ONE_ETH, "0x")
    ).to.be.revertedWith("account: not Owner or EntryPoint");
  });

  describe("#validateUserOp", () => {
    let account: SimpleAccount;
    let userOp: UserOperation;
    let userOpHash: string;
    let preBalance: number;
    let expectedPay: number;

    const actualGasPrice = 1e9;

    before(async () => {
      // that's the account of ethersSigner
      const accounts = await ethers.provider.listAccounts();
      const entryPoint = accounts[2];
      const accountOwner: any = createAccountOwner();
      const [signer] = await ethers.getSigners();
      ({ proxy: account } = await createAccount(
        await ethers.getSigner(entryPoint),
        accountOwner.address,
        entryPoint
      ));
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
