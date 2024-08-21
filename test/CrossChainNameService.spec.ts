import { expect } from "chai";
import { BigNumber } from "ethers";
import hre from "hardhat";

import {
  CCIPLocalSimulator,
  CrossChainNameServiceRegister,
  CrossChainNameServiceRegister__factory,
  CrossChainNameServiceReceiver,
  CrossChainNameServiceReceiver__factory,
  CrossChainNameServiceLookup,
  CrossChainNameServiceLookup__factory,
} from "../typechain-types";

describe("CrossChainNameService", function () {
  it("address of the registered name must be the EOA address.", async function () {
    const name = "alice.ccns";
    // prepare config and ccip local simulator
    const ccipLocalSimualtorFactory = await hre.ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    const ccipLocalSimulator: CCIPLocalSimulator =
      await ccipLocalSimualtorFactory.deploy();
    const config: {
      chainSelector_: BigNumber;
      sourceRouter_: string;
      destinationRouter_: string;
      wrappedNative_: string;
      linkToken_: string;
      ccipBnM_: string;
      ccipLnM_: string;
    } = await ccipLocalSimulator.configuration();
    // get signer
    const [alice] = await hre.ethers.getSigners();

    // deploy source smart contracts and link them
    const ccnsLookupFactory: CrossChainNameServiceLookup__factory =
      await hre.ethers.getContractFactory("CrossChainNameServiceLookup");
    const ccnsSourceLookup: CrossChainNameServiceLookup =
      await ccnsLookupFactory.deploy();
    const ccnsRegisterFactory: CrossChainNameServiceRegister__factory =
      await hre.ethers.getContractFactory("CrossChainNameServiceRegister");
    const ccnsRegister: CrossChainNameServiceRegister =
      await ccnsRegisterFactory.deploy(
        config.sourceRouter_,
        ccnsSourceLookup.address
      );
    await ccnsSourceLookup.setCrossChainNameServiceAddress(
      ccnsRegister.address
    );

    // deploy destination smart contracts and link them
    const ccnsDestinationLookup: CrossChainNameServiceLookup =
      await ccnsLookupFactory.deploy();
    const ccnsReceiverFactory: CrossChainNameServiceReceiver__factory =
      await hre.ethers.getContractFactory("CrossChainNameServiceReceiver");
    const ccnsReceiver: CrossChainNameServiceReceiver =
      await ccnsReceiverFactory.deploy(
        config.destinationRouter_,
        ccnsDestinationLookup.address,
        config.chainSelector_
      );
    await ccnsDestinationLookup.setCrossChainNameServiceAddress(
      ccnsReceiver.address
    );

    // link ccnsReceiver and ccnsRegister
    await ccnsRegister.enableChain(
      config.chainSelector_,
      ccnsReceiver.address,
      200_000
    );
    await ccnsRegister.register(name);

    const sourceNameAddress = await ccnsSourceLookup.lookup(name);
    expect(alice.address).equal(sourceNameAddress);
    const destinationNameAddress = await ccnsDestinationLookup.lookup(name);
    expect(alice.address).equal(destinationNameAddress);
  });
});
