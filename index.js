require('dotenv').config();

const axios = require('axios');
const assert = require('assert');

assert(process.env.PRIVATE_KEY, 'missing PRIVATE_KEY in .env file');

const Web3 = require('web3');
const pry = require('pryjs');
const BigNumber = require('bignumber.js');

const { ethers } = require('ethers');
const { LendingPoolABI } = require('./abis/LendingPoolABI.js');

const HDWalletProviderMnemonic = require('truffle-hdwallet-provider');
const HDWalletProviderPrivKeys = require('truffle-hdwallet-provider-privkey');

const prvteKey = process.env.PRIVATE_KEY;
const network  = process.env.NETWORK || 'mainnet';

let alchemyHost;
let infuraHost;

let alchemyKey;
let infuraKey;

let aaveILendingPoolAddress;

let tokenDAI;
let tokenUSDC;

switch(network) {
  case "mainnet":
    alchemyKey  = process.env.ALCHEMY_KEY_MAINNET;
    infuraKey   = process.env.INFURA_KEY_MAINNET;

    alchemyHost = `https://eth-mainnet.alchemyapi.io/v2/${alchemyKey}`;
    infuraHost  = `https://mainnet.infura.io/v3/${infuraKey}`;

    aaveILendingPoolAddress = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

    tokenDAI = {
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      symbol: 'DAI',
    }

    tokenUSDC = {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
    }

    break;
  case "ropsten":
    alchemyKey  = process.env.ALCHEMY_KEY_ROPSTEN;
    infuraKey   = process.env.INFURA_KEY_ROPSTEN;

    alchemyHost = `https://eth-ropsten.alchemyapi.io/v2/${alchemyKey}`;
    infuraHost  = `https://ropsten.infura.io/v3/${infuraKey}`;

    aaveILendingPoolAddress = null;

    tokenDAI = {};

    break;
  default:
    throw("Incorrect network passed");
}

// const alchemyProviderMn = new HDWalletProviderMnemonic(mnemonic, alchemyHost, 1);
// const infuraProviderMn  = new HDWalletProviderMnemonic(mnemonic, infuraHost, 1);

const alchemyProviderPk = new HDWalletProviderPrivKeys([prvteKey], alchemyHost, 1);
const infuraProviderPk  = new HDWalletProviderPrivKeys([prvteKey], infuraHost, 1);

const web3A = new Web3(alchemyProviderPk);
const web3I = new Web3(infuraProviderPk);
const eth3 = new ethers.providers.InfuraProvider(network, infuraKey);
const wallet = new ethers.Wallet(prvteKey, eth3);

const getGasNow = async () => {
  const response = await axios.get('https://www.gasnow.org/api/v3/gas/price');

  if (response.data.code !== 200) {
    throw `getGasNow returned invalid status code of: ${response.data.code}`;
  }

  return response.data.data;
};

const parseReserveData = async (token, data) => {
  console.log('\n')
  console.log(`${token.symbol} : ${token.address}`)
  console.log('==========================================================================')
  console.log(`totalLiquidity:          ${data.totalLiquidity / 1e18}`)
  console.log(`availableLiquidity:      ${data.availableLiquidity / 1e18}`)
  console.log(`totalBorrowsFixed:       ${data.totalBorrowsFixed / 1e18}`)
  console.log(`totalBorrowsVariable:    ${data.totalBorrowsVariable / 1e18}`)
  console.log(`liquidityRate:           ${data.liquidityRate / 1e27}`)
  console.log(`variableBorrowRate:      ${data.variableBorrowRate / 1e27}`)
  console.log(`fixedBorrowRate:         ${data.fixedBorrowRate / 1e27}`)
  console.log('---------------------------------------------------------')
  console.log(`averageFixedBorrowRate:  ${data.averageFixedBorrowRate}`)
  console.log(`utilizationRate:         ${data.utilizationRate}`)
  console.log(`liquidityIndex:          ${data.liquidityIndex}`)
  console.log(`variableBorrowIndex:     ${data.variableBorrowIndex}`)
  console.log('==========================================================================')
};

const runBot = async () => {

  let accounts;
  let arguments = {};

  const parseArguments = async () => {
    if (process.argv.length >= 2) {
      arguments.notifications = process.argv[2] === 'on' ? true : false;
    }
  };

  const loadAccounts = async () => {
    accounts = await web3A.eth.getAccounts();
  };

  await parseArguments();
  await loadAccounts();

  const AAVEILendingPool = new ethers.Contract(
    aaveILendingPoolAddress,
    LendingPoolABI, wallet,
  );

  eth3.on('block', async (blockNumber) => {
    try {
      console.log(`🧱blockNumber: ${blockNumber}`);

      let block = await web3A.eth.getBlock("latest");
      let gasLiSt = block.gasLimit;
      let gasLiHx = '0x' + gasLiSt.toString(16);
      let gasNowOrg = await getGasNow();
      
      console.log(`💸block transactions: ${block.transactions.length}`);
      console.log(`🧯gasLimit: [${gasLiSt} / ${gasLiHx}]`);
      console.log(`⛽️gasPrice: rapid -> ${gasNowOrg.rapid / 1000000000}`);

      const getReserveDataDAI = await AAVEILendingPool.getReserveData(tokenDAI.address);
      await parseReserveData(tokenDAI, getReserveDataDAI);

      const getReserveDataUSDC = await AAVEILendingPool.getReserveData(tokenUSDC.address);
      await parseReserveData(tokenUSDC, getReserveDataUSDC);


      // eval(pry.it);

    } catch (err) {
      console.error(err);
    }
  });
};

console.log('Starting...');
console.log(`Connected to: ${network}`);
console.log('\n');

runBot();