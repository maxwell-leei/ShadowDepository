import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const registry = await deploy("Shadowepository", {
    from: deployer,
    log: true,
  });

  console.log(`Shadowepository contract: ${registry.address}`);
};
export default func;
func.id = "deploy_shadowepository";
func.tags = ["Shadowepository"];
