import { ethers } from "hardhat";
import * as typ from "./solidityTypes";
import { arrayify, defaultAbiCoder, keccak256 } from "ethers/lib/utils";
import { Wallet } from "ethers";
import {
  ecsign,
  toRpcSig,
  keccak256 as keccak256_buffer,
} from "ethereumjs-util";

export interface UserOperation {
  sender: typ.address;
  nonce: typ.uint256;
  initCode: typ.bytes;
  callData: typ.bytes;
  callGasLimit: typ.uint256;
  verificationGasLimit: typ.uint256;
  preVerificationGas: typ.uint256;
  maxFeePerGas: typ.uint256;
  maxPriorityFeePerGas: typ.uint256;
  paymasterAndData: typ.bytes;
  signature: typ.bytes;
}

export const DefaultsForUserOp: UserOperation = {
  sender: ethers.constants.AddressZero,
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 100000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: "0x",
  signature: "0x",
};

function encode(
  typevalues: Array<{ type: string; val: any }>,
  forSignature: boolean
): string {
  const types = typevalues.map((typevalue) =>
    typevalue.type === "bytes" && forSignature ? "bytes32" : typevalue.type
  );
  const values = typevalues.map((typevalue) =>
    typevalue.type === "bytes" && forSignature
      ? keccak256(typevalue.val)
      : typevalue.val
  );
  return defaultAbiCoder.encode(types, values);
}

export function fillUserOpDefaults(
  op: Partial<UserOperation>,
  defaults = DefaultsForUserOp
): UserOperation {
  const partial: any = { ...op };
  // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
  // remove those so "merge" will succeed.
  for (const key in partial) {
    if (partial[key] == null) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete partial[key];
    }
  }
  const filled = { ...defaults, ...partial };
  return filled;
}

export function packUserOp(op: UserOperation, forSignature = true): string {
  if (forSignature) {
    // lighter signature scheme (must match UserOperation#pack): do encode a zero-length signature, but strip afterwards the appended zero-length value
    const userOpType = {
      components: [
        { type: "address", name: "sender" },
        { type: "uint256", name: "nonce" },
        { type: "bytes", name: "initCode" },
        { type: "bytes", name: "callData" },
        { type: "uint256", name: "callGasLimit" },
        { type: "uint256", name: "verificationGasLimit" },
        { type: "uint256", name: "preVerificationGas" },
        { type: "uint256", name: "maxFeePerGas" },
        { type: "uint256", name: "maxPriorityFeePerGas" },
        { type: "bytes", name: "paymasterAndData" },
        { type: "bytes", name: "signature" },
      ],
      name: "userOp",
      type: "tuple",
    };
    let encoded = defaultAbiCoder.encode(
      [userOpType as any],
      [{ ...op, signature: "0x" }]
    );
    // remove leading word (total length) and trailing word (zero-length signature)
    encoded = "0x" + encoded.slice(66, encoded.length - 64);
    return encoded;
  }
  const typevalues = [
    { type: "address", val: op.sender },
    { type: "uint256", val: op.nonce },
    { type: "bytes", val: op.initCode },
    { type: "bytes", val: op.callData },
    { type: "uint256", val: op.callGasLimit },
    { type: "uint256", val: op.verificationGasLimit },
    { type: "uint256", val: op.preVerificationGas },
    { type: "uint256", val: op.maxFeePerGas },
    { type: "uint256", val: op.maxPriorityFeePerGas },
    { type: "bytes", val: op.paymasterAndData },
  ];
  if (!forSignature) {
    // for the purpose of calculating gas cost, also hash signature
    typevalues.push({ type: "bytes", val: op.signature });
  }
  return encode(typevalues, forSignature);
}

export function getUserOpHash(
  op: UserOperation,
  entryPoint: string,
  chainId: number
): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = defaultAbiCoder.encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId]
  );
  return keccak256(enc);
}

export function signUserOp(
  op: UserOperation,
  signer: Wallet,
  entryPoint: string,
  chainId: number
): UserOperation {
  const message = getUserOpHash(op, entryPoint, chainId);
  const msg1 = Buffer.concat([
    Buffer.from("\x19Ethereum Signed Message:\n32", "ascii"),
    Buffer.from(arrayify(message)),
  ]);

  const sig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(arrayify(signer.privateKey))
  );
  // that's equivalent of:  await signer.signMessage(message);
  // (but without "async"
  const signedMessage1 = toRpcSig(sig.v, sig.r, sig.s);
  return {
    ...op,
    signature: signedMessage1,
  };
}
