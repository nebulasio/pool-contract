/** Local simulation environment code; Do not modify */
const neblocal = require('../../lib/neblocal')
const crypto = require('../../lib/crypto')
const BigNumber = require('bignumber.js')
const Blockchain = neblocal.Blockchain
const LocalContractStorage = neblocal.LocalContractStorage
const Event = neblocal.Event
/** Local simulation environment code; End. */

const AccumulatedMultiple = new BigNumber(10).pow(12).toString(10)

class PageData {

    constructor(storage, key, pageSize) {
        this._storage = storage
        this._key = key
        this._pageIndexes = null
        if (!pageSize) {
            pageSize = 200
        }
        this._pageSize = pageSize
    }

    getPageSize() {
        return this._pageSize
    }

    getPageIndexes() {
        if (!this._pageIndexes) {
            this._pageIndexes = this._storage.get(this._indexesKey())
        }
        if (!this._pageIndexes) {
            this._pageIndexes = []
        }
        return this._pageIndexes
    }

    getPageData(index) {
        let r = this._storage.get(this._dataKey(index))
        if (!r) {
            r = []
        }
        return r
    }

    addAll(data) {
        let indexes = this.getPageIndexes()
        let tempPageData = null
        for (let i = 0; i < data.length; ++i) {
            let obj = data[i]
            let p = null
            for (let i = 0; i < indexes.length; ++i) {
                let index = indexes[i]
                if (index.l < this._pageSize) {
                    p = index
                    break
                }
            }
            if (p == null) {
                let i = 0
                if (indexes.length > 0) {
                    i = indexes[indexes.length - 1].i + 1
                }
                p = { i: i, l: 0 }
                indexes.push(p)
            }

            if (tempPageData != null && tempPageData.index !== p.i) {
                this._storage.put(this._dataKey(tempPageData.index), tempPageData.data)
                tempPageData = null
            }
            if (!tempPageData) {
                tempPageData = { index: p.i, data: this.getPageData(p.i) }
            }
            let d = tempPageData.data
            d.push(obj)
            p.l += 1
        }
        if (tempPageData) {
            this._storage.put(this._dataKey(tempPageData.index), tempPageData.data)
        }
        this._saveIndexes()
    }

    add(obj) {
        let indexes = this.getPageIndexes()
        let p = null
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i]
            if (index.l < this._pageSize) {
                p = index
                break
            }
        }

        if (p == null) {
            let i = 0
            if (indexes.length > 0) {
                i = indexes[indexes.length - 1].i + 1
            }
            p = { i: i, l: 0 }
            this._addIndex(p)
        }

        let d = this.getPageData(p.i)
        d.push(obj)
        p.l += 1
        this._saveIndexes()
        this._storage.put(this._dataKey(p.i), d)
    }

    _indexesKey() {
        return "pis_" + this._key
    }

    _dataKey(index) {
        return "pd_" + this._key + "_" + index
    }

    _lastIndex() {
        let indexes = this.getPageIndexes()
        if (indexes.length > 0) {
            return indexes[indexes.length - 1]
        }
        return null
    }

    _addIndex(index) {
        this.getPageIndexes().push(index)
        this._saveIndexes()
    }

    _saveIndexes() {
        this._storage.put(this._indexesKey(), this.getPageIndexes())
    }

    _savePageData(index, data) {
        this._storage.put(this._dataKey(index), data)
    }
}

class Utils {

    static getNotNullArray(storage, key) {
        let r = storage.get(key)
        if (!r) {
            r = []
        }
        return r
    }

    static getValue(storage, storageKey, obj, key, defaultValue) {
        if (Utils.isNull(obj[key])) {
            let v = storage.get(storageKey)
            obj[key] = Utils.isNull(v) ? defaultValue : v
        }
        return obj[key]
    }

    static setValue(storage, storageKey, obj, key, value) {
        storage.set(storageKey, value)
        obj[key] = value
    }

    static isNull(o) {
        return typeof o === 'undefined' || o == null
    }

    static verifyBool(o) {
        if (typeof o !== 'boolean') {
            throw new Error(`${o} is not a boolean type`)
        }
    }

    static verifyAddress(address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error(`Not a valid address: ${address}`)
        }
    }
}

class StateObj {
    constructor(storage, stateKey) {
        this.storage = storage
        this._stateKey = stateKey
    }

    getState(key, defaultValue) {
        if (Utils.isNull(defaultValue)) {
            defaultValue = null
        }
        return Utils.getValue(this.storage, `${this._stateKey}_${key}`, this, `_sv_${key}`, defaultValue)
    }

    setState(key, value) {
        Utils.setValue(this.storage, `${this._stateKey}_${key}`, this, `_sv_${key}`, value)
    }
}

class Data extends StateObj {
    constructor(storage, key) {
        super(storage, key)
        this._pages = new PageData(storage, key, 200)
        this._cache = {}
    }

    _genKey(key) {
        let dkey = this._stateKey + '_k_' + key
        return dkey
    }

    setData(key, value) {
        let data = this.getData(key)
        if (!data) {
            this._pages.add(key)
        }
        this.setState(this._genKey(key), value)
        this._cache[key] = value
    }

    getData(key) {
        if ((typeof this._cache[key]) === 'undefined') {
            this._cache[key] = this.getState(this._genKey(key))
        }
        return this._cache[key]
    }

    getPageIndexes() {
        return this._pages.getPageIndexes()
    }

    getPageData(index) {
        let data = {}
        let keys = this._pages.getPageData(index)
        for (let key of keys) {
            data[key] = this.getData(key)
        }
        return data
    }

    getLength() {
        let indexes = this.getPageIndexes()
        if (indexes.length > 0) {
            let index = indexes[indexes.length - 1]
            return index.i * this._pages.getPageSize() + index.l
        } else {
            return 0
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

class Pool extends BaseContract {
    constructor() {
        super('Pool')
        LocalContractStorage.defineMapProperty(this, '_storage', null)

        // userInfo {
        //     amount: // How many LP tokens the user has provided.
        //     rewardDebt: // Reward debt. See explanation below.
        // }
        //
        // We do some fancy math here. Basically, any point in time, the amount of token
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
        // poolInfo {
        //     lpToken: // Address of LP token contract.
        //     allocPoint: // How many allocation points assigned to this pool.
        //     lastRewardBlock: // Last block number that the distribution occurs.
        //     accPerShare // Accumulated per share, times 1e12. See below.
        // }
        this._poolInfo = new Data(this._storage, 'pool')
        this._userInfo = new Data(this._storage, 'user')

        LocalContractStorage.defineProperties(this, {
            _totalAllocPoint: null,
            _totalBalance: null
        });
    }

    accept() {
        throw new Error('do not accept transfers.')
    }

    _verifyFromProxy() {
        if (this.config.poolProxy !== Blockchain.transaction.from) {
            throw new Error('No permissions.')
        }
    }

    _verifyPool(_pid) {
        let pool = this._poolInfo.getData(_pid)
        if (!pool) {
            throw new Error('pool not found.')
        }
        return pool
    }

    // Add a new lp to the pool. Can only be called by the owner.
    add(_allocPoint, _lpToken, _withUpdate) {
        this._verifyFromProxy()

        if (_withUpdate) {
            this.massUpdatePools()
        }
        let height = Blockchain.block.height
        let lastRewardBlock = height > this.config.startBlock ? height : this.config.startBlock
        let totalAllocPoint = this._totalAllocPoint || 0
        this._totalAllocPoint = new BigNumber(totalAllocPoint).add(_allocPoint).toString(10)
        this._poolInfo.setData(this._poolInfo.getLength(), {
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accPerShare: '0'
        })
    }

    // Update the given pool's allocation point. Can only be called by the owner.
    set(_pid, _allocPoint, _withUpdate) {
        this._verifyFromProxy()

        let pool = this._verifyPool(_pid)
        if (_withUpdate) {
            this.massUpdatePools()
        }
        let totalAllocPoint = this._totalAllocPoint || 0
        this._totalAllocPoint = new BigNumber(totalAllocPoint).sub(pool.allocPoint).add(_allocPoint)

        pool.allocPoint = _allocPoint
        this._poolInfo.setData(_pid, pool)
    }

    _poolUserKey(_pid, _user) {
        return _pid + ':' + _user
    }

    _balanceOf(_token, _addr) {
        let tokenContract = new Blockchain.Contract(_token) 
        return tokenContract.call('balanceOf', _addr)
    }

    pendingToken(_pid, _user) {
        let pool = this._verifyPool(_pid)

        let accPerShare = pool.accPerShare
        let user = this._userInfo.getData(this._poolUserKey(_pid, _user))
        let lpSupply = this._balanceOf(pool.lpToken, Blockchain.transaction.to)

        let height = Blockchain.block.height
        if (height > pool.lastRewardBlock && new BigNumber(lpSupply).gt(0)) {
            let state = Blockchain.getAccountState(this.config.poolProxy)

            let balance = this._totalBalance || '0'
            let pendingToken = new BigNumber(state.balance).sub(balance)
            let reward = pendingToken.times(pool.allocPoint).div(this._totalAllocPoint).toFixed(0, BigNumber.ROUND_DOWN)
            accPerShare =  new BigNumber(accPerShare).add(reward.times(AccumulatedMultiple).div(lpSupply));
        }
        return new BigNumber(user.amount).times(accPerShare).div(AccumulatedMultiple).sub(user.rewardDebt).toFixed(0, BigNumber.ROUND_DOWN)
    }

    updatePoolBalance() {
        this._verifyFromProxy()
        let state = Blockchain.getAccountState(this.config.poolProxy)
        this._totalBalance = state.balance
    }

    // Update reward vairables for all pools.
    massUpdatePools() {
        let state = Blockchain.getAccountState(this.config.poolProxy)
        let length = this.poolLength()

        let balance = this._totalBalance || '0'
        let pendingToken = new BigNumber(state.balance).sub(balance)
        for (let pid = 0; pid < length; pid++) {
            this._updatePool(pid, pendingToken)
        }
        this._totalBalance = state.balance
    }

    // Update reward variables of the given pool to be up-to-date.
    _updatePool(_pid, _pendingToken) {
        let pool = this._verifyPool(_pid)
        if (Blockchain.block.height <= pool.lastRewardBlock) {
            return
        }
        let lpSupply = this._balanceOf(pool.lpToken, this.config.poolProxy)
        if (new BigNumber(lpSupply).gt(0) && new BigNumber(_pendingToken).gt(0)) {
            let reward = new BigNumber(_pendingToken).times(pool.allocPoint).div(this._totalAllocPoint).toFixed(0, BigNumber.ROUND_DOWN)
            pool.accPerShare = new BigNumber(pool.accPerShare).add(new BigNumber(reward).times(AccumulatedMultiple).div(lpSupply)).toFixed(0, BigNumber.ROUND_DOWN)
        }
        pool.lastRewardBlock = Blockchain.block.height
        this._poolInfo.setData(_pid, pool)
    }

    // Deposit LP tokens to pool for token allocation.
    deposit(_from, _pid, _amount) {
        this._verifyFromProxy()

        this.massUpdatePools()

        let pool = this._verifyPool(_pid)
        let from = _from
        let ukey = this._poolUserKey(_pid, from)
        let user = this._userInfo.getData(ukey) || { amount: '0'}
        user.amount = new BigNumber(user.amount).add(_amount).toFixed(0, BigNumber.ROUND_DOWN)
        user.rewardDebt = new BigNumber(user.amount).times(pool.accPerShare).div(AccumulatedMultiple).toFixed(0, BigNumber.ROUND_DOWN)
        this._userInfo.setData(ukey, user)
        return pool
    }

    claim(_from, _pid) {
        this._verifyFromProxy()

        this.massUpdatePools()

        let pool = this._verifyPool(_pid)
        let ukey = this._poolUserKey(_pid, _from)
        let user = this._userInfo.getData(ukey)
        if (!user) {
            throw new Error('user not found')
        }
        let reward = this._handleReward(pool, user)
        user.rewardDebt = new BigNumber(user.amount).times(pool.accPerShare).div(AccumulatedMultiple).toFixed(0, BigNumber.ROUND_DOWN)
        this._userInfo.setData(ukey, user)
        return reward
    }

    _handleReward(_pool, _user) {
        let pending = new BigNumber(_user.amount).times(_pool.accPerShare).div(AccumulatedMultiple).sub(_user.rewardDebt).toFixed(0, BigNumber.ROUND_DOWN)
        return pending
    }

     // Withdraw LP tokens from pool.
    withdraw(_from, _pid, _amount) {
        this._verifyFromProxy()

        this.massUpdatePools()

        let from = _from
        let pool = this._verifyPool(_pid)
        let ukey = this._poolUserKey(_pid, from)
        let user = this._userInfo.getData(ukey)
        if (!user) {
            throw new Error('user not found')
        }
        if (new BigNumber(_amount).gt(user.amount)) {
            throw new Error('withdraw: insufficient balance')
        }

        let reward = this._handleReward(pool, user)

        user.amount = new BigNumber(user.amount).sub(_amount)
        user.rewardDebt = new BigNumber(user.amount).times(pool.accPerShare).toFixed(0, BigNumber.ROUND_DOWN)
        this._userInfo.setData(ukey, user)

        return {lpToken: pool.lpToken, reward: reward}
    }

    poolLength() {
        return this._poolInfo.getLength()
    }

    getPool(_pid) {
        return this._verifyPool(_pid)
    }

    getUserInfo(_user) {
        let poolCount = this.poolLength()
        let info = {}
        for (let pid = 0; pid < poolCount; pid++) {
            let data = this.getUserPoolInfo(_user, pid)
            if (data) {
                info[pid] = data
            }
        }
        return info
    }

    getUserPoolInfo(_user, _pid) {
        return this._userInfo.getData(this._poolUserKey(_pid, _user))
    }

    getUserPageIndexes() {
        return this._userInfo.getPageIndexes()
    }

    getUserPageData(index) {
        let keys = this._userInfo.getPageData(index)
        let datas = []
        for (let key of keys) {
            let keyArray = key.split(':')
            let data = {
                poolId: keyArray[0],
                info: this._userInfo.getData(key)
            }
        }
        return datas
    }

}


module.exports = Pool
