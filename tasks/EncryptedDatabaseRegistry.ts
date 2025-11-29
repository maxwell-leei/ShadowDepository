import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import type { EncryptedDatabaseRegistry } from "../types";

const CONTRACT_NAME = "EncryptedDatabaseRegistry";

task("task:address", "Prints the EncryptedDatabaseRegistry address").setAction(async (_taskArguments, hre) => {
  const deployment = await hre.deployments.get(CONTRACT_NAME);
  console.log(`${CONTRACT_NAME} address: ${deployment.address}`);
});

task("task:create-database", "Creates a new encrypted database")
  .addParam("name", "Database name")
  .addParam("secret", "Decrypted database address (hex string)")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get(CONTRACT_NAME);
    const owner = (await ethers.getSigners())[0];
    const registry = (await ethers.getContractAt(
      CONTRACT_NAME,
      deployment.address,
    )) as EncryptedDatabaseRegistry;

    const encryptedAddress = await fhevm
      .createEncryptedInput(deployment.address, owner.address)
      .addAddress(taskArguments.secret as string)
      .encrypt();

    const commitment = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [taskArguments.secret]),
    );

    const tx = await registry
      .connect(owner)
      .createDatabase(
        taskArguments.name as string,
        commitment,
        encryptedAddress.handles[0],
        encryptedAddress.inputProof,
      );
    console.log(`Create database tx: ${tx.hash}`);
    await tx.wait();
  });

task("task:store-value", "Stores an encrypted number in a database")
  .addParam("database", "Database id")
  .addParam("secret", "Decrypted database address")
  .addParam("value", "Number to store (uint32)")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get(CONTRACT_NAME);
    const owner = (await ethers.getSigners())[0];
    const registry = (await ethers.getContractAt(
      CONTRACT_NAME,
      deployment.address,
    )) as EncryptedDatabaseRegistry;

    const encryptedValue = await fhevm
      .createEncryptedInput(deployment.address, owner.address)
      .add32(Number(taskArguments.value))
      .encrypt();

    const commitment = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [taskArguments.secret]),
    );

    const tx = await registry
      .connect(owner)
      .storeEncryptedValue(
        Number(taskArguments.database),
        commitment,
        encryptedValue.handles[0],
        encryptedValue.inputProof,
      );
    console.log(`Store value tx: ${tx.hash}`);
    await tx.wait();
  });

task("task:list-databases", "Lists database ids owned by the first signer").setAction(async (_args, hre) => {
  const { ethers, deployments } = hre;
  const owner = (await ethers.getSigners())[0];
  const deployment = await deployments.get(CONTRACT_NAME);
  const registry = (await ethers.getContractAt(
    CONTRACT_NAME,
    deployment.address,
  )) as EncryptedDatabaseRegistry;

  const ids = await registry.getOwnedDatabases(owner.address);
  console.log(`Databases owned by ${owner.address}: ${ids.map(id => id.toString()).join(", ") || "none"}`);
});
