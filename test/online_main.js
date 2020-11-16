/** Automatically generated code, please do not modify. */
const MultiSig = require('./contracts/MultiSig/online.js').testnet
const MultiSigMainnet = require('./contracts/MultiSig/online.js').mainnet
const NASNAXLP = require('./contracts/NASNAXLP/online.js').testnet
const NASNAXLPMainnet = require('./contracts/NASNAXLP/online.js').mainnet
const Pool = require('./contracts/Pool/online.js').testnet
const PoolMainnet = require('./contracts/Pool/online.js').mainnet
const PoolProxy = require('./contracts/PoolProxy/online.js').testnet
const PoolProxyMainnet = require('./contracts/PoolProxy/online.js').mainnet
const USDTNASLP = require('./contracts/USDTNASLP/online.js').testnet
const USDTNASLPMainnet = require('./contracts/USDTNASLP/online.js').mainnet
const USDTNAXLP = require('./contracts/USDTNAXLP/online.js').testnet
const USDTNAXLPMainnet = require('./contracts/USDTNAXLP/online.js').mainnet
/** Automatically generated code; End. */

const TestKeys = require('../lib/test_keys.js')
const ConfigRunner = require('../lib/config_runner.js')
const ConfigManager = require('../lib/config_manager.js')
const NebUtil = require('../lib/neb_util.js')
const BigNumber = require('bignumber.js')
const TestUtils = require('./utils.js')

const callerAddr = TestKeys.caller.getAddressString()

class PoolTest {
    async deploy() {
        await MultiSig._deploy([callerAddr])
        await Pool._deploy(ConfigManager.getOnlineContractAddress(MultiSig))
        await PoolProxy._deploy(ConfigManager.getOnlineContractAddress(MultiSig))
        // let swap = callerAddr
        // await NASNAXLP._deploy(swap, "Nebulas NAS-NAX LPToken", "LP-NAS-NAX", 18)
        // await USDTNASLP._deploy(swap, "Nebulas nUSDT-NAS LPToken", "LP-nUSDT-NAS", 18)
        // await USDTNAXLP._deploy(swap, "Nebulas nUSDT-NAX LPToken", "LP-nUSDT-NAX", 18)

        // await NASNAXLP.mint(callerAddr, "1000000000000000000")
        // await USDTNAXLP.mint(callerAddr, "1000000000000000000")
        // await USDTNAXLP.mint(callerAddr, "1000000000000000000")
    }

    async setConfig() {
        let sysConfig = {
            config: {
                'multiSig': ConfigManager.getOnlineContractAddress(MultiSig),
                'pool': ConfigManager.getOnlineContractAddress(Pool),
                'poolProxy': ConfigManager.getOnlineContractAddress(PoolProxy),
                'assetManagers': [callerAddr],
                'dataManagers': [callerAddr],

            },
            contractList: {
                'pool': ConfigManager.getOnlineContractAddress(Pool),
                'poolProxy': ConfigManager.getOnlineContractAddress(PoolProxy),
            }
        }

        await MultiSig.setConfig(sysConfig)
    }

    async addPool() {
        await PoolProxy.add(3, ConfigManager.getOnlineContractAddress(NASNAXLP), true)
        await PoolProxy.add(2, ConfigManager.getOnlineContractAddress(USDTNAXLP), true)
        await PoolProxy.add(1, ConfigManager.getOnlineContractAddress(USDTNASLP), true)
        // TestUtils.log('pool 0', PoolProxy.getPoolTest(0))
        // TestUtils.log('pool 1', PoolProxy.getPoolTest(1))
        // TestUtils.log('pool 2', PoolProxy.getPoolTest(2))
    }

    async setPool() {
        await PoolProxy.set(0, 6, true)
        TestUtils.log('set pool 0', PoolProxy.getPoolTest(0))
    }

    async deposit(value) {
        let balance = await NASNAXLP.balanceOfTest(TestKeys.caller.getAddressString())
        await NASNAXLP.approve(ConfigManager.getOnlineContractAddress(PoolProxy), '0', balance.toString(10))
        await PoolProxy.deposit(0, new BigNumber(balance).div(10).toFixed(0, BigNumber.ROUND_DOWN))
        TestUtils.log('nas nax', await PoolProxy.getUserPoolInfoTest(TestKeys.caller.getAddressString(), 0))

        balance = await USDTNAXLP.balanceOfTest(TestKeys.caller.getAddressString())
        await USDTNAXLP.approve(ConfigManager.getOnlineContractAddress(PoolProxy), '0', balance.toString(10))
        await PoolProxy.deposit(1, new BigNumber(balance).div(10).toFixed(0, BigNumber.ROUND_DOWN))
        TestUtils.log('usdt nax', await PoolProxy.getUserPoolInfoTest(TestKeys.caller.getAddressString(), 1))

        balance = await USDTNASLP.balanceOfTest(TestKeys.caller.getAddressString())
        await USDTNASLP.approve(ConfigManager.getOnlineContractAddress(PoolProxy), '0', balance.toString(10))
        await PoolProxy.deposit(2, new BigNumber(balance).div(10).toFixed(0, BigNumber.ROUND_DOWN))
        TestUtils.log('usdt nas', await PoolProxy.getUserPoolInfoTest(TestKeys.caller.getAddressString(), 2))
    }

    async claim() {
        TestUtils.log('0 pool pending', PoolProxy.pendingToken(0, callerAddr))
        TestUtils.log('1 pool pending', PoolProxy.pendingToken(1, callerAddr))
        TestUtils.log('2 pool pending', PoolProxy.pendingToken(2, callerAddr))

        PoolProxy.claim(0)
        PoolProxy.claim(1)
        PoolProxy.claim(2)

        // PoolProxy.claim(3)
    }

    async withdraw(value) {
        PoolProxy.withdraw(0, '1')
    }
}


async function main() {

    TestUtils.log('deployer', TestKeys.deployer.getAddressString())
    TestUtils.log('caller', TestKeys.caller.getAddressString())

    let test = new PoolTest()
    // await test.deploy()
    // await test.setConfig()
    TestUtils.log('config', await MultiSig.getConfigTest())
    // await test.addPool()
    // test.setPool()
    test.deposit('1000000')
    // test.claim()
    // test.withdraw(value)
}

main()
