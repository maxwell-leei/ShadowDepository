import { expect } from "chai";
import { deployments, ethers, fhevm } from "hardhat";
import { EncryptedDatabaseRegistry } from "../types";

describe("EncryptedDatabaseRegistrySepolia", function () {
  let registry: EncryptedDatabaseRegistry;

  before(async function () {
    if (fhevm.isMock) {
      console.warn("Run this suite on Sepolia after deploying the contract");
      this.skip();
    }

    try {
      const deployment = await deployments.get("EncryptedDatabaseRegistry");
      registry = (await ethers.getContractAt(
        "EncryptedDatabaseRegistry",
        deployment.address,
      )) as EncryptedDatabaseRegistry;
    } catch (error) {
      (error as Error).message += ". Call 'npx hardhat deploy --network sepolia' first.";
      throw error;
    }
  });

  it("reads the total database count", async function () {
    const total = await registry.totalDatabases();
    expect(total).to.be.gte(0n);
  });
});
