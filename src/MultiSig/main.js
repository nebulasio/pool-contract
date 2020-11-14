/** Local simulation environment code; Do not modify */
const neblocal = require('../../lib/neblocal')
const crypto = require('../../lib/crypto')
const BigNumber = require('bignumber.js')
const Blockchain = neblocal.Blockchain
const LocalContractStorage = neblocal.LocalContractStorage
const Event = neblocal.Event
/** Local simulation environment code; End. */


class MultiSig {

    constructor() {
        this.__contractName = "MultiSig"

        this._allContractNames = [
            'pool',
            'poolProxy'
        ]

        this._allConfigNames = [
            'multiSig',
            'pool',
            'poolProxy'
        ]

        LocalContractStorage.defineProperties(this, {
            _coSigners: null,
            _config: null
        })
    }

    init(coSigners) {
        if (!coSigners || coSigners.length === 0) {
            throw ("Need at least one co-signers")
        }
        for (let i = 0; i < coSigners.length; ++i) {
            this._verifyAddress(coSigners[i])
        }
        this._coSigners = coSigners
    }

    accept() {
        throw new Error('do not accept transfers.')
    }


    getConfig() {
        return this._config
    }

    setConfig(sysConfig) {
        this._verifyCosigner()
        this._verifyConfig(sysConfig)
        let config = sysConfig.config
        let contractList = sysConfig.contractList
        for (let contractName in contractList) {
            let v = contractList[contractName]
            let contractObj = new Blockchain.Contract(v)
            contractObj.call("setConfig", config)
        }
        this._config = sysConfig
    }


    getCosigners() {
        return this._coSigners
    }

    setCosigners(coSigners) {
        this._verifyCosigner()
        if (!coSigners || !(coSigners instanceof Array) || coSigners.length == 0) {
            throw ("signers format error!")
        }
        for (let i = 0; i < coSigners.length; ++i) {
            this._verifyAddress(coSigners[i])
        }
        this._coSigners = coSigners
    }


    _verifyCosigner() {
        if (this._coSigners.indexOf(Blockchain.transaction.from) < 0) {
            throw ("Permission Denied!")
        }
    }

    _verifyConfig(sysConfig) {
        this._verifyProperties(sysConfig, ["config", "contractList"])
        this._verifyProperties(sysConfig.config, this._allConfigNames)
        this._verifyProperties(sysConfig.contractList, this._allContractNames)

        for (let n in sysConfig.contractList) {
            this._verifyAddress(sysConfig.contractList[n])
        }
    }

    _verifyProperties(obj, propertyNames) {
        for (let i = 0; i < propertyNames.length; ++i) {
            if (typeof obj[propertyNames[i]] === 'undefined') {
                throw (propertyNames[i] + " not found.")
            }
        }
    }

    _verifyAddress(address) {
        if (Blockchain.verifyAddress(address) === 0) {
            console.log(new Error().stack)
            throw ("Address format error, address=" + address)
        }
    }
}


module.exports = MultiSig
