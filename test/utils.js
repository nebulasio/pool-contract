const BigNumber = require('bignumber.js')
const LocalContext = require('../lib/neblocal.js').LocalContext


class Utils {

    static log(k, o) {
        if (o) {
            console.log(`\n=== ${k} ===\n${JSON.stringify(o)}`)
        } else {
            console.log(`\n=== ${k} ===`)
        }
    }

    static balance(address) {
        return new BigNumber(LocalContext.getBalance(address)).toString(10)
    }

    static nas(value) {
        return Utils.nasUnit.times(value).toString(10)
    }

    static nax(value) {
        return Utils.naxUnit.times(value).toString(10)
    }

    static usdt(value) {
        return Utils.usdtUnit.times(value).toString(10)
    }
}

Utils.nasUnit = new BigNumber(10).pow(18)
Utils.naxUnit = new BigNumber(10).pow(9)
Utils.usdtUnit = new BigNumber(10).pow(6)

module.exports = Utils
