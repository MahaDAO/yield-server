const utils = require('../utils');
const sdk = require('@defillama/sdk');
const superagent = require('superagent');

const bscPools = {
  elipsisARTHBUSD: '0x21dE718BCB36F649E1A7a7874692b530Aa6f986d',
  dotdotARTHBUSD: '0x21dE718BCB36F649E1A7a7874692b530Aa6f986d',
  arthMahadao: '0x2c360b513AE52947EEb37cfAD57ac9B7c9373e1B',
};

const ABIS = {
  getEntireSystemColl: {
    inputs: [],
    name: 'getEntireSystemColl',
    outputs: [
      {
        internalType: 'uint256',
        name: 'entireSystemColl',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  getMCR: {
    inputs: [],
    name: 'MCR',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
};

const troveManagerTVL = async () => {
  const TROVE_MANAGER_ADDRESS = '0x8b1da95724b1e376ae49fdb67afe33fe41093af5';
  const LUSD_ADDRESS = '0x8cc0f052fff7ead7f2edcccac895502e884a8a71';
  const URL = 'https://api.instadapp.io/defi/mainnet/liquity/trove-types';

  const troveEthTvl = (
    await sdk.api.abi.call({
      target: TROVE_MANAGER_ADDRESS,
      abi: ABIS.getEntireSystemColl,
      chain: 'ethereum',
    })
  ).output;

  const mcr = (
    await sdk.api.abi.call({
      target: TROVE_MANAGER_ADDRESS,
      abi: ABIS.getMCR,
      chain: 'ethereum',
    })
  ).output;

  const troveType = (await superagent.get(URL)).body;

  const lusdTotalSupply = (
    await sdk.api.abi.call({
      target: LUSD_ADDRESS,
      abi: 'erc20:totalSupply',
      chain: 'ethereum',
    })
  ).output;

  const prices = (
    await superagent.post('https://coins.llama.fi/prices').send({
      coins: [`ethereum:${LUSD_ADDRESS}`],
    })
  ).body.coins;

  const totalSupplyUsd =
    (Number(lusdTotalSupply) / 1e18) *
    prices[`ethereum:${LUSD_ADDRESS.toLowerCase()}`].price;

  return [
    {
      pool: TROVE_MANAGER_ADDRESS,
      project: 'mahadao-arth',
      symbol: 'WETH',
      chain: 'ethereum',
      apy: 0,
      tvlUsd: (Number(troveEthTvl) / 1e18) * Number(troveType.price),
      //   apyBaseBorrow: Number(troveType.borrowFee) * 100,
      apyBaseBorrow: Number(0) * 100, // atm borrowing fee is 0
      totalSupplyUsd: (Number(troveEthTvl) / 1e18) * Number(troveType.price),
      totalBorrowUsd: totalSupplyUsd,
      ltv: 1 / (mcr / 1e18),
      mintedCoin: 'ARTH',
    },
  ];
};

const getAypData = async (pool) => {
  const apyData = await utils.getData(
    'https://api.arthcoin.com/apy/guageV3Apy'
  );
  const poolData = apyData[pool];
  return poolData;
};

const stabilityEthPool = async (data) => {
  return [
    {
      pool: `0x910f16455e5eb4605fe639e2846579c228eed3b5-ethereum`.toLowerCase(),
      chain: utils.formatChain('eth'),
      project: 'mahadao-arth',
      rewardTokens: ['0x745407c86df8db893011912d3ab28e68b62e49b0', 'ETH'],
      underlyingTokens: ['0x8cc0f052fff7ead7f2edcccac895502e884a8a71'],
      symbol: utils.formatSymbol('arth'),
      tvlUsd: Number(data.tvlUSD),
      apy: Number(data.current.min),
    },
  ];
};

const poolsFunction = async () => {
  const data = await utils.getData('https://api.arthcoin.com/apr/all');

  return [
    ...(await stabilityEthPool(data['eth-sp'])),
    ...(await troveManagerTVL()),
  ];
};

module.exports = {
  timetravel: false,
  apy: poolsFunction,
  url: 'https://farming.mahadao.com',
};
