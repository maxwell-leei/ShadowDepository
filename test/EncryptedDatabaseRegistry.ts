import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import {
  EncryptedDatabaseRegistry,
  EncryptedDatabaseRegistry__factory,
} from "../types";

type Signers = {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "EncryptedDatabaseRegistry",
  )) as EncryptedDatabaseRegistry__factory;
  const registry = (await factory.deploy()) as EncryptedDatabaseRegistry;
  const address = await registry.getAddress();

  return { registry, address };
}

describe("EncryptedDatabaseRegistry", function () {
  let signers: Signers;
  let registry: EncryptedDatabaseRegistry;
  let contractAddress: string;

  before(async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    signers = { owner, alice, bob };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("Run this test suite on the local FHEVM mock network");
      this.skip();
    }

    ({ registry, address: contractAddress } = await deployFixture());
  });

  async function createDatabaseFixture(secretAddress: string, name = "Vault") {
    const encryptedAddress = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .addAddress(secretAddress)
      .encrypt();

    const commitment = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [secretAddress]),
    );

    const tx = await registry
      .connect(signers.owner)
      .createDatabase(
        name,
        commitment,
        encryptedAddress.handles[0],
        encryptedAddress.inputProof,
      );
    await tx.wait();

    return { commitment };
  }

  it("creates databases with encrypted addresses and commitment tracking", async function () {
    const secretAddress = ethers.Wallet.createRandom().address;

    const { commitment } = await createDatabaseFixture(secretAddress, "My DB");

    const database = await registry.getDatabase(1);
    expect(database.owner).to.eq(signers.owner.address);
    expect(database.name).to.eq("My DB");
    expect(database.addressCommitment).to.eq(commitment);
    expect(database.encryptedDatabaseAddress).to.not.eq(ethers.ZeroHash);

    const owned = await registry.getOwnedDatabases(signers.owner.address);
    expect(owned.length).to.eq(1);
    expect(owned[0]).to.eq(1n);

    const decryptors = await registry.getDatabaseDecryptors(1);
    expect(decryptors).to.deep.equal([signers.owner.address]);
  });

  it("stores encrypted values and allows new decryptors to read them", async function () {
    const secretAddress = ethers.Wallet.createRandom().address;
    const { commitment } = await createDatabaseFixture(secretAddress);

    const encryptedValue = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .add32(1234)
      .encrypt();

    await registry
      .connect(signers.owner)
      .storeEncryptedValue(
        1,
        commitment,
        encryptedValue.handles[0],
        encryptedValue.inputProof,
      );

    const storedValues = await registry.getDatabaseValues(1);
    expect(storedValues.length).to.eq(1);

    const ownerValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      storedValues[0],
      contractAddress,
      signers.owner,
    );
    expect(ownerValue).to.eq(1234);

    await registry
      .connect(signers.owner)
      .grantDecryptPermission(1, signers.bob.address);

    const bobValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      storedValues[0],
      contractAddress,
      signers.bob,
    );
    expect(bobValue).to.eq(1234);
  });

  it("reverts when storing with invalid commitments", async function () {
    const secretAddress = ethers.Wallet.createRandom().address;
    await createDatabaseFixture(secretAddress);

    const encryptedValue = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .add32(42)
      .encrypt();

    await expect(
      registry
        .connect(signers.owner)
        .storeEncryptedValue(
          1,
          ethers.ZeroHash,
          encryptedValue.handles[0],
          encryptedValue.inputProof,
        ),
    ).to.be.revertedWithCustomError(registry, "InvalidCommitment");
  });
});
