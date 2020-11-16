/** Automatically generated code, please do not modify. */
const MultiSig = require('./contracts/MultiSig/local.js')
const NASNAXLP = require('./contracts/NASNAXLP/local.js')
const Pool = require('./contracts/Pool/local.js')
const PoolProxy = require('./contracts/PoolProxy/local.js')
const USDTNASLP = require('./contracts/USDTNASLP/local.js')
const USDTNAXLP = require('./contracts/USDTNAXLP/local.js')
/** Automatically generated code; End. */

const TestKeys = require('../lib/test_keys.js')
const LocalContext = require('../lib/neblocal.js').LocalContext
const ConfigRunner = require('../lib/config_runner.js')
const BigNumber = require('bignumber.js')
const TestUtils = require('./utils.js')

// 清空模拟环境数据
LocalContext.clearData()

const callerAddr = TestKeys.caller.getAddressString()

class PoolTest {
    deploy() {
        MultiSig._deploy([callerAddr])
        Pool._deploy(LocalContext.getContractAddress(MultiSig))
        PoolProxy._deploy(LocalContext.getContractAddress(MultiSig))
        let swap = callerAddr
        NASNAXLP._deploy(swap, "Nebulas NAS-NAX LPToken", "LP-NAS-NAX", 18)
        USDTNASLP._deploy(swap, "Nebulas nUSDT-NAS LPToken", "LP-nUSDT-NAS", 18)
        USDTNAXLP._deploy(swap, "Nebulas nUSDT-NAX LPToken", "LP-nUSDT-NAX", 18)

        NASNAXLP.mint(callerAddr, "1000000000000000000")
        USDTNAXLP.mint(callerAddr, "1000000000000000000")
        USDTNAXLP.mint(callerAddr, "1000000000000000000")
    }

    setConfig() {
        let sysConfig = {
            config: {
                'multiSig': LocalContext.getContractAddress(MultiSig),
                'pool': LocalContext.getContractAddress(Pool),
                'poolProxy': LocalContext.getContractAddress(PoolProxy),
                'assetManagers': [callerAddr],
                'dataManagers': [callerAddr],

            },
            contractList: {
                'pool': LocalContext.getContractAddress(Pool),
                'poolProxy': LocalContext.getContractAddress(PoolProxy),
            }
        }

        MultiSig.setConfig(sysConfig)
    }

    addPool() {
        PoolProxy.add(3, LocalContext.getContractAddress(NASNAXLP), true)
        PoolProxy.add(2, LocalContext.getContractAddress(USDTNAXLP), true)
        PoolProxy.add(1, LocalContext.getContractAddress(USDTNASLP), true)
        TestUtils.log('pool 0', PoolProxy.getPool(0))
        TestUtils.log('pool 1', PoolProxy.getPool(1))
        TestUtils.log('pool 2', PoolProxy.getPool(2))
    }

    setPool() {
        PoolProxy.set(0, 6, true)
        TestUtils.log('set pool 0', PoolProxy.getPool(0))
    }

    deposit(value) {
        let balance = NASNAXLP.balanceOf(TestKeys.caller.getAddressString())
        NASNAXLP.approve(LocalContext.getContractAddress(PoolProxy), '0', balance.toString(10))
        PoolProxy.deposit(0, new BigNumber(balance).div(10).toFixed(0, BigNumber.ROUND_DOWN))
        TestUtils.log('nas nax', PoolProxy.getUserPoolInfo(TestKeys.caller.getAddressString(), 0))

        balance = USDTNAXLP.balanceOf(TestKeys.caller.getAddressString())
        USDTNAXLP.approve(LocalContext.getContractAddress(PoolProxy), '0', balance.toString(10))
        PoolProxy.deposit(1, new BigNumber(balance).div(10).toFixed(0, BigNumber.ROUND_DOWN))
        TestUtils.log('usdt nax', PoolProxy.getUserPoolInfo(TestKeys.caller.getAddressString(), 1))

        balance = USDTNASLP.balanceOf(TestKeys.caller.getAddressString())
        USDTNASLP.approve(LocalContext.getContractAddress(PoolProxy), '0', balance.toString(10))
        PoolProxy.deposit(2, new BigNumber(balance).div(10).toFixed(0, BigNumber.ROUND_DOWN))
        TestUtils.log('usdt nas', PoolProxy.getUserPoolInfo(TestKeys.caller.getAddressString(), 2))
    }

    claim() {
        TestUtils.log('0 pool pending', PoolProxy.pendingToken(0, callerAddr))
        TestUtils.log('1 pool pending', PoolProxy.pendingToken(1, callerAddr))
        TestUtils.log('2 pool pending', PoolProxy.pendingToken(2, callerAddr))

        PoolProxy.claim(0)
        PoolProxy.claim(1)
        PoolProxy.claim(2)

        // PoolProxy.claim(3)
    }

    withdraw(value) {
        PoolProxy.withdraw(0, '1')
    }
}


async function main() {
    LocalContext.clearData()
    LocalContext.transfer(null, TestKeys.caller.getAddressString(), TestUtils.nas('10000000'))

    let value = '1'
    let test = new PoolTest()
    test.deploy()
    test.setConfig()
    test.addPool()
    test.setPool()
    test.deposit(value)
    LocalContext.transfer(null, LocalContext.getContractAddress(PoolProxy), TestUtils.nas('10000'))
    LocalContext.blockHeight++
    test.claim()
    test.withdraw(value)
}

main()
