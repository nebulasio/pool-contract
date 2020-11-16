/** Local simulation environment code; Do not modify */
const neblocal = require('../../lib/neblocal')
const crypto = require('../../lib/crypto')
const BigNumber = require('bignumber.js')
const { _account } = require('../../test/contracts/PoolProxy/local')
const Blockchain = neblocal.Blockchain
const LocalContractStorage = neblocal.LocalContractStorage
const Event = neblocal.Event
/** Local simulation environment code; End. */

class Utils {

    static isNull(o) {
        return typeof o === 'undefined' || o == null
    }

    static verifyBool(o) {
        if (typeof o !== 'boolean') {
            throw new Error(`${o} is not a boolean type`)
        }
    }

    static transferNAS(to, value) {
        if (!Blockchain.transfer(to, value)) {
            throw new Error('transfer failed.')
        }
    }
}

class BaseContract {

    constructor(name) {
        this.__contractName = name
        LocalContractStorage.defineProperty(this, '_config', null)
    }

    get config() {
        if (!this.__config) {
            this.__config = this._config
        }
        return this.__config
    }

    init(multiSig) {
        this._verifyAddress(multiSig)
        this._config = {
            multiSig: multiSig
        }
    }

    setConfig(config) {
        this._verifyFromMultiSig()
        this._verifyAddress(config.multiSig)
        this._config = config
    }

    getConfig() {
        return this.config
    }

    _verifyFromMultiSig() {
        if (Blockchain.transaction.from !== this.config.multiSig) {
            throw new Error('No permissions.')
        }
    }

    _verifyFromAssetManager() {
        if (this.config.assetManagers.indexOf(Blockchain.transaction.from) < 0) {
            throw new Error('No asset permissions.')
        }
    }

    _verifyFromDataManager() {
        if (this.config.dataManagers.indexOf(Blockchain.transaction.from) < 0) {
            throw new Error('No data permissions.')
        }
    }

    _verifyAddress(address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error(`Not a valid address: ${address}`)
        }
    }

}

class PoolProxy extends BaseContract {
    constructor() {
        super('PoolProxy')
    }

    get poolContract() {
        if (Utils.isNull(this._poolContract)) {
            this._poolContract = new Blockchain.Contract(this.config.pool)
        }
        return this._poolContract
    }

    accept() {
        Event.Trigger('transfer', {
            from: Blockchain.transaction.from,
            to: Blockchain.transaction.to,
            value: Blockchain.transaction.value,
        })
    }

    // 管理员提款
    transferFund(token, toAddr, amount) {
        if (!toAddr) {
            toAddr = Blockchain.transaction.from
        }
        this._verifyFromAssetManager()
        if (token.toLocaleUpperCase() === "NAS") {
            Utils.transferNAS(toAddr, amount)
        } else {
            this._verifyAddress(token)
            let tokenContract = new Blockchain.Contract(token)
            tokenContract.call('transfer', toAddr, amount)
        }
        this.poolContract.call('updatePoolBalance')
        Event.Trigger("PoolProxy: transferFund", {
            Transfer: {
                from: Blockchain.transaction.to,
                to: toAddr,
                token: token,
                value: amount
            }
        })
    }

    pendingToken(_pid, _user) {
        return this.poolContract.call('pendingToken', _pid, _user)
    }

    deposit(_pid, _amount) {
        let from = Blockchain.transaction.from
        let pool = this.poolContract.call('deposit', from, _pid, _amount)
        new Blockchain.Contract(pool.lpToken).call('transferFrom', from, Blockchain.transaction.to, _amount)
        this._depositEvent(true, from, _pid, _amount)
    }

    _depositEvent(_status, _from, _pid, _value) {
        Event.Trigger('Pool', {
            Status: _status,
            Deposit: {
                from: _from,
                poolId: _pid,
                value: _value
            }
        })
    }

    claim(_pid) {
        let from = Blockchain.transaction.from
        let reward = this.poolContract.call('claim', from, _pid)
        this._transferReward(reward)

        this.poolContract.call('updatePoolBalance')

        Event.Trigger('Pool', {Stateus: true, Claim: {from: from, poolId: _pid}})
    }

    _transferReward(reward) {
        console.log('transfer reward:', reward)
        if (new BigNumber(reward).gt(0)) {
            Utils.transferNAS(Blockchain.transaction.from, reward)
        }
        this.poolContract.call('updatePoolBalance')
    }

    withdraw(_pid, _amount) {
        let from = Blockchain.transaction.from
        let data = this.poolContract.call('withdraw', from, _pid, _amount)
        this._transferReward(data.reward)

        new Blockchain.Contract(data.lpToken).call('transfer', from, _amount)
        this._withdrawEvent(true, Blockchain.transaction.to, from, _amount)
    }

    _withdrawEvent(_status, _from, _to, _value) {
        Event.Trigger('Pool', {
            Status: _status,
            Withdraw: {
                from: _from,
                to: _to,
                value: _value
            }
        })
    }

    // Add a new lp to the pool. Can only be called by the owner.
    add(_allocPoint, _lpToken, _withUpdate) {
        this._verifyFromDataManager()

        this.poolContract.call('add', _allocPoint, _lpToken, _withUpdate)
    }

    // Update the given pool's allocation point. Can only be called by the owner.
    set(_pid, _allocPoint, _withUpdate) {
        this._verifyFromDataManager()

        this.poolContract.call('set', _pid, _allocPoint, _withUpdate)
    }

    getPoolLength() {
        return this.poolContract.call('poolLength')
    }

    getPool(_pid) {
        return this.poolContract.call('getPool', _pid)
    }

    getUserInfo(_user) {
        return this.poolContract.call('getUserInfo', _user)
    }

    getUserPoolInfo(_user, _pid) {
        return this.poolContract.call('getUserPoolInfo', _user, _pid)
    }

    getUserPageIndexes() {
        return this.poolContract.call('getUserPageIndexes')
    }

    getUserPageData(index) {
        return this.poolContract.call('getUserPageData', index)
    }
}


module.exports = PoolProxy
